#!/usr/bin/env bash
#
# One-shot host setup for a fresh Oracle Ampere A1 instance (Ubuntu 24.04 arm64).
#
#   sudo ./bootstrap.sh
#
# Idempotent — safe to re-run after changing deploy/.env.

set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR_DEFAULT=/srv/actual/data

[[ "$EUID" -eq 0 ]] || { echo "run with sudo" >&2; exit 1; }

echo "==> packages"
apt-get update --quiet
apt-get install --yes --quiet \
  ca-certificates curl gnupg rsync sqlite3 age rclone

echo "==> docker"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=arm64 signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    >/etc/apt/sources.list.d/docker.list
  apt-get update --quiet
  apt-get install --yes --quiet \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

echo "==> config"
if [[ ! -f "$DEPLOY_DIR/.env" ]]; then
  cp "$DEPLOY_DIR/.env.example" "$DEPLOY_DIR/.env"
  chmod 600 "$DEPLOY_DIR/.env"
  echo "    created $DEPLOY_DIR/.env — fill it in before continuing"
fi
# shellcheck disable=SC1090
set -a && source "$DEPLOY_DIR/.env" && set +a
DATA_DIR="${ACTUAL_DATA_DIR:-$DATA_DIR_DEFAULT}"

echo "==> data directory $DATA_DIR"
# The image drops to uid 1001; the bind mount has to match or the server cannot
# write its own database.
mkdir --parents "$DATA_DIR"
chown --recursive 1001:1001 "$DATA_DIR"

echo "==> registry auth"
# GHCR packages are private by default even when the repository is public. Set
# the package to public in GitHub, or provide a read:packages token here.
if [[ -n "${GHCR_USER:-}" && -n "${GHCR_TOKEN:-}" ]]; then
  printf '%s' "$GHCR_TOKEN" | docker login ghcr.io --username "$GHCR_USER" --password-stdin
fi

echo "==> scripts"
chmod +x "$DEPLOY_DIR"/*.sh

echo "==> systemd units"
for unit in "$DEPLOY_DIR"/systemd/*.service "$DEPLOY_DIR"/systemd/*.timer; do
  sed "s|__DEPLOY_DIR__|$DEPLOY_DIR|g" "$unit" >"/etc/systemd/system/$(basename "$unit")"
done
systemctl daemon-reload
systemctl enable --now actual-update.timer actual-backup.timer

echo "==> starting the stack"
cd "$DEPLOY_DIR"
docker compose --file compose.prod.yml --env-file .env up --detach

cat <<'EOF'

Done. Remaining manual steps (see deploy/README.md):

  1. Point the Cloudflare tunnel's public hostname at http://actual:5006
  2. Open the site, create the admin user, log in
  3. Settings -> AI: paste the Anthropic key
     Settings -> Bank sync: paste the Pluggy credentials
     (these are NOT environment variables; they live in account.sqlite)
  4. Run a restore rehearsal:  ./restore.sh --list

EOF
