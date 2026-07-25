#!/usr/bin/env bash
#
# Provisions the Always Free e2-micro host on Google Cloud, via the gcloud CLI.
#
#   PROJECT_ID=my-project ./provision-gcp.sh
#
# Idempotent: reuses an existing firewall rule and instance with the same name.
#
# Unlike Oracle's A1.Flex, this shape does not suffer chronic capacity
# shortages, and `gcloud compute instances create` is synchronous — it returns
# RUNNING or a real error, no polling loop needed. The only constraint worth
# automating is that the Always Free e2-micro instance-month is scoped to
# exactly three regions (us-west1, us-central1, us-east1); pick the wrong one
# and it quietly starts billing. This script defaults to us-central1 and keeps
# the boot disk on pd-standard at exactly 30 GB, the free-tier limit — a
# pd-balanced or pd-ssd disk of the same size is NOT included in the free tier.

set -euo pipefail

NAME="${NAME:-actual-ai}"
REGION="${REGION:-us-central1}"
ZONE="${ZONE:-${REGION}-a}"
MACHINE_TYPE="${MACHINE_TYPE:-e2-micro}"
BOOT_GB="${BOOT_GB:-30}"
IMAGE_FAMILY="${IMAGE_FAMILY:-ubuntu-2404-lts-amd64}"
IMAGE_PROJECT="${IMAGE_PROJECT:-ubuntu-os-cloud}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519.pub}"
SSH_USER="${SSH_USER:-ubuntu}"

command -v gcloud >/dev/null || { echo "gcloud CLI not found — see docs/DEPLOY.md" >&2; exit 1; }
[[ -f "$SSH_KEY" ]] || { echo "no public key at $SSH_KEY (ssh-keygen -t ed25519)" >&2; exit 1; }

: "${PROJECT_ID:?set PROJECT_ID to the dedicated GCP project (see docs/DEPLOY.md — do not reuse an unrelated project)}"

case "$REGION" in
  us-west1 | us-central1 | us-east1) ;;
  *)
    echo "REGION=$REGION is not one of the three Always Free e2-micro regions" >&2
    echo "(us-west1, us-central1, us-east1) — this would be billed." >&2
    exit 1
    ;;
esac

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
step() { printf '    %s ... ' "$*"; }
done_() { printf '%s\n' "${1:-ok}"; }

# Every gcloud call goes through this: stdin closed so a call can never block on
# a hidden prompt (this is exactly how the first Oracle provisioning run
# stalled — see provision-oracle.sh), stderr captured and shown on failure
# instead of discarded.
GCLOUD_ERR="$(mktemp)"
trap 'rm -f "$GCLOUD_ERR"' EXIT
gcloud_() {
  local out status
  out="$(gcloud --project="$PROJECT_ID" "$@" 2>"$GCLOUD_ERR" </dev/null)"
  status=$?
  if (( status != 0 )); then
    printf '\n' >&2
    printf 'gcloud %s\n' "$*" >&2
    cat "$GCLOUD_ERR" >&2
    return "$status"
  fi
  printf '%s' "$out"
}

say "Project"
gcloud_ projects describe "$PROJECT_ID" --format='value(projectId)' >/dev/null \
  || { echo "project $PROJECT_ID not found or not accessible" >&2; exit 1; }
echo "    $PROJECT_ID"

say "Compute Engine API"
step "checking"
if [[ "$(gcloud_ services list --enabled --filter='config.name:compute.googleapis.com' --format='value(config.name)')" == "compute.googleapis.com" ]]; then
  done_ "enabled"
else
  done_ "enabling (first time takes ~1min)"
  gcloud_ services enable compute.googleapis.com >/dev/null
fi

# --- network ------------------------------------------------------------
# Nothing needs an inbound port for the app itself: cloudflared dials out. The
# only ingress opened is SSH, for managing the box. New GCP projects come with
# a `default` VPC and a `default-allow-ssh` rule already — this only creates
# one if that project had the default network's auto-firewall disabled by
# org policy.

say "Firewall (tcp/22)"
step "checking for an existing SSH rule"
if gcloud_ compute firewall-rules describe "${NAME}-allow-ssh" --format='value(name)' >/dev/null 2>&1 \
  || gcloud_ compute firewall-rules list --filter='name:default-allow-ssh' --format='value(name)' | grep -q .; then
  done_ "present"
else
  done_ "none"
  step "creating ${NAME}-allow-ssh"
  gcloud_ compute firewall-rules create "${NAME}-allow-ssh" \
    --network=default --direction=INGRESS --action=ALLOW \
    --rules=tcp:22 --source-ranges=0.0.0.0/0 >/dev/null
  done_
fi

# --- instance -------------------------------------------------------------

say "Existing instance?"
step "looking"
STATUS="$(gcloud_ compute instances describe "$NAME" --zone="$ZONE" --format='value(status)' 2>/dev/null || true)"
if [[ "$STATUS" == "RUNNING" ]]; then
  done_ "already running"
else
  done_ "none"

  say "Launching $MACHINE_TYPE in $ZONE (Always Free)"
  step "creating"
  gcloud_ compute instances create "$NAME" \
    --zone="$ZONE" \
    --machine-type="$MACHINE_TYPE" \
    --image-family="$IMAGE_FAMILY" --image-project="$IMAGE_PROJECT" \
    --boot-disk-size="${BOOT_GB}GB" --boot-disk-type=pd-standard \
    --metadata="ssh-keys=${SSH_USER}:$(cat "$SSH_KEY")" \
    --format='value(name)' >/dev/null
  done_ "running"
fi

say "Public IP"
step "resolving"
PUBLIC_IP="$(gcloud_ compute instances describe "$NAME" --zone="$ZONE" \
  --format='value(networkInterfaces[0].accessConfigs[0].natIP)')"
done_ "$PUBLIC_IP"

cat <<EOF

Done.

  instance   $NAME ($ZONE)
  public ip  $PUBLIC_IP
  ssh        ssh $SSH_USER@$PUBLIC_IP

Free-tier reminder: this is free as long as it stays a single non-preemptible
e2-micro in us-west1, us-central1 or us-east1, with a pd-standard boot disk at
or under 30 GB — all of which this script enforced. Changing any of those later
(bigger disk, different machine type, a second instance under the same billing
account) starts billing against actual-ai-financas's linked account.

Next: docs/DEPLOY.md, stage 8 (bootstrap.sh) — this VM is amd64, so the
multi-arch image published by fork-image.yml resolves automatically to the
right architecture; nothing else in the deploy path changes.
EOF
