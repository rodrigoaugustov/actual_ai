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
# wizard by hand for every retry. This retries automatically across every
# availability domain the region has (many regions, including sa-saopaulo-1,
# have exactly one — the loop still applies, it just has one AD to iterate)
# until it lands, which can take hours — start it and walk away.

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
step() { printf '    %s ... ' "$*"; }
done_() { printf '%s\n' "${1:-ok}"; }

# Every OCI call goes through this. Two things it guarantees:
#
#   * stdin is /dev/null, so a call can never block on a hidden prompt. This
#     script runs unattended for hours; a prompt nobody sees is indistinguishable
#     from a hang, and that is exactly how the first run of this script stalled.
#   * stderr is captured and shown on failure instead of being discarded, so a
#     real error is never silent.
#
# Usage:  out="$(oci_ some oci args...)"  — returns non-zero on failure with the
# CLI's own message on stderr.
oci_() {
  local out status
  out="$(oci "$@" 2>"$OCI_ERR" </dev/null)"
  status=$?
  if (( status != 0 )); then
    printf '\n' >&2
    printf 'oci %s\n' "$*" >&2
    cat "$OCI_ERR" >&2
    return "$status"
  fi
  printf '%s' "$out"
}

OCI_ERR="$(mktemp)"
trap 'rm -f "$OCI_ERR"' EXIT

# Poll for a lifecycle state ourselves instead of using the CLI's
# `--wait-for-state`. That flag runs its own polling loop with a progress
# indicator, which is the one piece of this script that cannot be verified
# without creating billable resources — and when it misbehaves it looks exactly
# like a hang. Polling here is explicit, bounded, and prints where it is.
#
#   wait_state <desired> <oci get args...>
wait_state() {
  local want="$1"; shift
  local deadline state
  deadline=$(( $(date +%s) + ${WAIT_TIMEOUT:-900} ))
  while (( $(date +%s) < deadline )); do
    state="$(oci "$@" --query 'data."lifecycle-state"' --raw-output 2>/dev/null </dev/null || true)"
    case "$state" in
      "$want") return 0 ;;
      TERMINATING|TERMINATED|FAILED)
        printf '\n' >&2
        echo "resource went to $state instead of $want" >&2
        return 1
        ;;
    esac
    printf '.'
    sleep 5
  done
  printf '\n' >&2
  echo "timed out waiting for $want (last state: ${state:-unknown})" >&2
  return 1
}

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
#
# The console's "VCN with Internet Connectivity" wizard builds all of this
# correctly in one step, and is frankly the better tool for it — this section
# exists only to keep the whole thing reproducible. Pass SUBNET_ID to skip it
# and go straight to the launch retry loop, which is the part worth automating:
#
#   SUBNET_ID=ocid1.subnet.oc1... ./provision-oracle.sh

if [[ -n "${SUBNET_ID:-}" ]]; then
  say "Network"
  step "using the subnet you passed in"
  # Fail early on a typo rather than at launch time, hours later.
  oci_ network subnet get --subnet-id "$SUBNET_ID" --query 'data.id' --raw-output >/dev/null
  done_ "$SUBNET_ID"
else

say "VCN"
step "looking for an existing VCN named $NAME"
VCN_ID="$(oci_ network vcn list --compartment-id "$COMPARTMENT" --display-name "$NAME" \
  --query 'data[0].id' --raw-output || true)"
if [[ -z "$VCN_ID" || "$VCN_ID" == "null" ]]; then
  done_ "none"
  step "creating"
  VCN_ID="$(oci_ network vcn create --compartment-id "$COMPARTMENT" \
    --display-name "$NAME" --cidr-blocks "[\"$VCN_CIDR\"]" \
    --dns-label "${NAME//-/}" \
    --query 'data.id' --raw-output)"
  wait_state AVAILABLE network vcn get --vcn-id "$VCN_ID"
  done_ "$VCN_ID"
else
  done_ "reusing $VCN_ID"
fi

say "Internet gateway"
step "looking"
IGW_ID="$(oci_ network internet-gateway list --compartment-id "$COMPARTMENT" --vcn-id "$VCN_ID" \
  --query 'data[0].id' --raw-output || true)"
if [[ -z "$IGW_ID" || "$IGW_ID" == "null" ]]; then
  done_ "none"
  step "creating"
  IGW_ID="$(oci_ network internet-gateway create --compartment-id "$COMPARTMENT" \
    --vcn-id "$VCN_ID" --is-enabled true --display-name "$NAME" \
    --query 'data.id' --raw-output)"
  wait_state AVAILABLE network internet-gateway get --ig-id "$IGW_ID"
  done_ "$IGW_ID"
else
  done_ "reusing $IGW_ID"
fi

say "Route table"
step "default route -> internet gateway"
RT_ID="$(oci_ network vcn get --vcn-id "$VCN_ID" --query 'data."default-route-table-id"' --raw-output)"
oci_ network route-table update --rt-id "$RT_ID" --force \
  --route-rules "[{\"destination\":\"0.0.0.0/0\",\"destinationType\":\"CIDR_BLOCK\",\"networkEntityId\":\"$IGW_ID\"}]" \
  >/dev/null
done_

say "Security list"
step "egress all, ingress tcp/22 only"
SL_ID="$(oci_ network vcn get --vcn-id "$VCN_ID" --query 'data."default-security-list-id"' --raw-output)"
oci_ network security-list update --security-list-id "$SL_ID" --force \
  --egress-security-rules '[{"destination":"0.0.0.0/0","protocol":"all","isStateless":false}]' \
  --ingress-security-rules '[{"source":"0.0.0.0/0","protocol":"6","isStateless":false,"tcpOptions":{"destinationPortRange":{"min":22,"max":22}}}]' \
  >/dev/null
done_

say "Subnet"
step "looking"
SUBNET_ID="$(oci_ network subnet list --compartment-id "$COMPARTMENT" --vcn-id "$VCN_ID" \
  --display-name "$NAME" --query 'data[0].id' --raw-output || true)"
if [[ -z "$SUBNET_ID" || "$SUBNET_ID" == "null" ]]; then
  done_ "none"
  step "creating"
  SUBNET_ID="$(oci_ network subnet create --compartment-id "$COMPARTMENT" --vcn-id "$VCN_ID" \
    --display-name "$NAME" --cidr-block "$SUBNET_CIDR" \
    --prohibit-public-ip-on-vnic false \
    --query 'data.id' --raw-output)"
  wait_state AVAILABLE network subnet get --subnet-id "$SUBNET_ID"
  done_ "$SUBNET_ID"
else
  done_ "reusing $SUBNET_ID"
fi

fi # end of the network section skipped by SUBNET_ID

# --- instance ---------------------------------------------------------------

say "Existing instance?"
step "looking"
INSTANCE_ID="$(oci_ compute instance list --compartment-id "$COMPARTMENT" --display-name "$NAME" \
  --lifecycle-state RUNNING --query 'data[0].id' --raw-output || true)"

if [[ -n "$INSTANCE_ID" && "$INSTANCE_ID" != "null" ]]; then
  done_ "already running: $INSTANCE_ID"
else
  done_ "none"

  say "Ubuntu 24.04 aarch64 image"
  step "resolving"
  IMAGE_ID="$(oci_ compute image list --compartment-id "$COMPARTMENT" \
    --operating-system 'Canonical Ubuntu' --operating-system-version '24.04' \
    --shape "$SHAPE" --sort-by TIMECREATED --sort-order DESC \
    --query 'data[0].id' --raw-output)"
  [[ -n "$IMAGE_ID" && "$IMAGE_ID" != "null" ]] || { echo "no matching image" >&2; exit 1; }
  done_ "$IMAGE_ID"

  step "availability domains"
  mapfile -t ADS < <(oci_ iam availability-domain list --compartment-id "$COMPARTMENT" \
    --query 'data[].name' --raw-output | jq -r '.[]')
  (( ${#ADS[@]} > 0 )) || { echo "no availability domains returned" >&2; exit 1; }
  done_ "${#ADS[@]}"

  say "Launching (retrying on OutOfHostCapacity — this can take hours)"

  METADATA="$(jq -n --arg k "$(cat "$SSH_KEY")" '{ssh_authorized_keys: $k}')"
  attempt=0
  while (( attempt < MAX_ATTEMPTS )); do
    for ad in "${ADS[@]}"; do
      attempt=$(( attempt + 1 ))
      printf '    [%3d] %s %s ... ' "$attempt" "$(date +%H:%M:%S)" "$ad"
      # Not via oci_: a failure here is the expected case, and the error text is
      # inspected rather than printed.
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
            --query 'data.id' --raw-output 2>"$OCI_ERR" </dev/null)"; then
        # OutOfHostCapacity comes back synchronously from launch, so reaching
        # here means the request was accepted and the instance is provisioning.
        printf 'accepted, provisioning '
        wait_state RUNNING compute instance get --instance-id "$INSTANCE_ID" || exit 1
        echo " running"
        break 2
      fi
      # Only capacity errors are worth retrying. A quota, permission or bad
      # image error would otherwise loop silently for hours.
      if ! grep --quiet --ignore-case 'out of host capacity\|outofhostcapacity' "$OCI_ERR"; then
        echo "error"
        printf '\n' >&2
        cat "$OCI_ERR" >&2
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
step "resolving"
VNIC_ID="$(oci_ compute instance list-vnics --instance-id "$INSTANCE_ID" \
  --query 'data[0].id' --raw-output)"
PUBLIC_IP="$(oci_ network vnic get --vnic-id "$VNIC_ID" --query 'data."public-ip"' --raw-output)"
done_ "$PUBLIC_IP"

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
