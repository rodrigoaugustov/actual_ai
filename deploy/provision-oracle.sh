#!/usr/bin/env bash
#
# Provisions the Always Free Ampere host on Oracle Cloud, via the OCI CLI.
#
#   ./provision-oracle.sh
#
# Idempotent: reuses an existing VCN, subnet and instance with the same names.
#
# The reason this is a script and not a few clicks in the console: Always Free
# A1 capacity is almost never available on the first try. `oci compute instance
# launch` fails with OutOfHostCapacity, and the console makes you redo the whole
# wizard. This retries across every availability domain until it lands, which
# can take hours — start it and walk away.

set -euo pipefail

NAME="${NAME:-actual-ai}"
SHAPE="${SHAPE:-VM.Standard.A1.Flex}"
OCPUS="${OCPUS:-2}"
MEMORY_GB="${MEMORY_GB:-12}"
BOOT_GB="${BOOT_GB:-100}"
VCN_CIDR="${VCN_CIDR:-10.0.0.0/16}"
SUBNET_CIDR="${SUBNET_CIDR:-10.0.1.0/24}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519.pub}"
RETRY_SECONDS="${RETRY_SECONDS:-90}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-200}"

command -v oci >/dev/null || { echo "oci CLI not found — see docs/DEPLOY.md" >&2; exit 1; }
command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }
[[ -f "$SSH_KEY" ]] || { echo "no public key at $SSH_KEY (ssh-keygen -t ed25519)" >&2; exit 1; }

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

# The root compartment is the tenancy itself. Read it from the config `oci setup
# config` wrote, rather than trying to spot it in a compartment listing.
if [[ -z "${COMPARTMENT:-}" ]]; then
  OCI_PROFILE="${OCI_PROFILE:-DEFAULT}"
  COMPARTMENT="$(awk -v profile="[$OCI_PROFILE]" '
    $0 == profile {inside = 1; next}
    /^\[/ {inside = 0}
    inside && /^tenancy[[:space:]]*=/ {sub(/^[^=]*=[[:space:]]*/, ""); print; exit}
  ' "${OCI_CONFIG_FILE:-$HOME/.oci/config}" 2>/dev/null || true)"
fi
[[ -n "$COMPARTMENT" ]] || {
  echo "could not resolve the tenancy OCID — run 'oci setup config', or set COMPARTMENT" >&2
  exit 1
}
say "Compartment"
echo "    $COMPARTMENT"

# --- network ----------------------------------------------------------------
# Nothing needs an inbound port for the app itself: cloudflared dials out. The
# only ingress opened is SSH, for managing the box.

say "VCN"
VCN_ID="$(oci network vcn list --compartment-id "$COMPARTMENT" --display-name "$NAME" \
  --query 'data[0].id' --raw-output 2>/dev/null || true)"
if [[ -z "$VCN_ID" || "$VCN_ID" == "null" ]]; then
  VCN_ID="$(oci network vcn create --compartment-id "$COMPARTMENT" \
    --display-name "$NAME" --cidr-blocks "[\"$VCN_CIDR\"]" \
    --dns-label "${NAME//-/}" --wait-for-state AVAILABLE \
    --query 'data.id' --raw-output)"
  echo "    created $VCN_ID"
else
  echo "    reusing $VCN_ID"
fi

say "Internet gateway"
IGW_ID="$(oci network internet-gateway list --compartment-id "$COMPARTMENT" --vcn-id "$VCN_ID" \
  --query 'data[0].id' --raw-output 2>/dev/null || true)"
if [[ -z "$IGW_ID" || "$IGW_ID" == "null" ]]; then
  IGW_ID="$(oci network internet-gateway create --compartment-id "$COMPARTMENT" \
    --vcn-id "$VCN_ID" --is-enabled true --display-name "$NAME" \
    --wait-for-state AVAILABLE --query 'data.id' --raw-output)"
  echo "    created $IGW_ID"
else
  echo "    reusing $IGW_ID"
fi

say "Route table"
RT_ID="$(oci network vcn get --vcn-id "$VCN_ID" --query 'data."default-route-table-id"' --raw-output)"
oci network route-table update --rt-id "$RT_ID" --force \
  --route-rules "[{\"destination\":\"0.0.0.0/0\",\"destinationType\":\"CIDR_BLOCK\",\"networkEntityId\":\"$IGW_ID\"}]" \
  >/dev/null
echo "    default route -> internet gateway"

say "Security list"
SL_ID="$(oci network vcn get --vcn-id "$VCN_ID" --query 'data."default-security-list-id"' --raw-output)"
oci network security-list update --security-list-id "$SL_ID" --force \
  --egress-security-rules '[{"destination":"0.0.0.0/0","protocol":"all","isStateless":false}]' \
  --ingress-security-rules '[{"source":"0.0.0.0/0","protocol":"6","isStateless":false,"tcpOptions":{"destinationPortRange":{"min":22,"max":22}}}]' \
  >/dev/null
echo "    egress all, ingress tcp/22 only"

say "Subnet"
SUBNET_ID="$(oci network subnet list --compartment-id "$COMPARTMENT" --vcn-id "$VCN_ID" \
  --display-name "$NAME" --query 'data[0].id' --raw-output 2>/dev/null || true)"
if [[ -z "$SUBNET_ID" || "$SUBNET_ID" == "null" ]]; then
  SUBNET_ID="$(oci network subnet create --compartment-id "$COMPARTMENT" --vcn-id "$VCN_ID" \
    --display-name "$NAME" --cidr-block "$SUBNET_CIDR" \
    --prohibit-public-ip-on-vnic false --wait-for-state AVAILABLE \
    --query 'data.id' --raw-output)"
  echo "    created $SUBNET_ID"
else
  echo "    reusing $SUBNET_ID"
fi

# --- instance ---------------------------------------------------------------

say "Existing instance?"
INSTANCE_ID="$(oci compute instance list --compartment-id "$COMPARTMENT" --display-name "$NAME" \
  --lifecycle-state RUNNING --query 'data[0].id' --raw-output 2>/dev/null || true)"

if [[ -n "$INSTANCE_ID" && "$INSTANCE_ID" != "null" ]]; then
  echo "    already running: $INSTANCE_ID"
else
  say "Ubuntu 24.04 aarch64 image"
  IMAGE_ID="$(oci compute image list --compartment-id "$COMPARTMENT" \
    --operating-system 'Canonical Ubuntu' --operating-system-version '24.04' \
    --shape "$SHAPE" --sort-by TIMECREATED --sort-order DESC \
    --query 'data[0].id' --raw-output)"
  [[ -n "$IMAGE_ID" && "$IMAGE_ID" != "null" ]] || { echo "no matching image" >&2; exit 1; }
  echo "    $IMAGE_ID"

  mapfile -t ADS < <(oci iam availability-domain list --compartment-id "$COMPARTMENT" \
    --query 'data[].name' --raw-output | jq -r '.[]')
  say "Launching (${#ADS[@]} availability domains, retrying on OutOfHostCapacity)"

  METADATA="$(jq -n --arg k "$(cat "$SSH_KEY")" '{ssh_authorized_keys: $k}')"
  ERR="$(mktemp)"
  trap 'rm -f "$ERR"' EXIT
  attempt=0
  while (( attempt < MAX_ATTEMPTS )); do
    for ad in "${ADS[@]}"; do
      attempt=$(( attempt + 1 ))
      printf '    [%3d] %s ... ' "$attempt" "$ad"
      if INSTANCE_ID="$(oci compute instance launch \
            --availability-domain "$ad" \
            --compartment-id "$COMPARTMENT" \
            --shape "$SHAPE" \
            --shape-config "{\"ocpus\":$OCPUS,\"memoryInGBs\":$MEMORY_GB}" \
            --image-id "$IMAGE_ID" \
            --subnet-id "$SUBNET_ID" \
            --assign-public-ip true \
            --boot-volume-size-in-gbs "$BOOT_GB" \
            --display-name "$NAME" \
            --metadata "$METADATA" \
            --wait-for-state RUNNING \
            --query 'data.id' --raw-output 2>"$ERR")"; then
        echo "launched"
        break 2
      fi
      # Only capacity errors are worth retrying. A quota, permission or bad
      # image error would otherwise loop silently for hours.
      if ! grep --quiet --ignore-case 'out of host capacity\|outofhostcapacity' "$ERR"; then
        echo "error"
        printf '\n' >&2
        cat "$ERR" >&2
        echo "Not a capacity problem — stopping." >&2
        exit 1
      fi
      echo "no capacity"
      sleep "$RETRY_SECONDS"
    done
  done

  [[ -n "${INSTANCE_ID:-}" && "$INSTANCE_ID" != "null" ]] \
    || { echo "gave up after $MAX_ATTEMPTS attempts — Always Free A1 capacity is scarce, try again later" >&2; exit 1; }
fi

say "Public IP"
VNIC_ID="$(oci compute instance list-vnics --instance-id "$INSTANCE_ID" \
  --query 'data[0].id' --raw-output)"
PUBLIC_IP="$(oci network vnic get --vnic-id "$VNIC_ID" --query 'data."public-ip"' --raw-output)"
echo "    $PUBLIC_IP"

cat <<EOF

Done.

  instance   $INSTANCE_ID
  public ip  $PUBLIC_IP
  ssh        ssh ubuntu@$PUBLIC_IP

Note: Oracle's Ubuntu images ship iptables rules that drop everything except
SSH, and they survive \`ufw allow\`. This deployment does not care — cloudflared
only makes outbound connections — but it is why you must not "fix" it by
opening ports later expecting that to be enough.

Next: docs/DEPLOY.md, stage 5.
EOF
