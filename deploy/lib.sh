#!/usr/bin/env bash
# Shared helpers for the deploy scripts. Sourced, not executed.

set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$DEPLOY_DIR/compose.prod.yml"
ENV_FILE="$DEPLOY_DIR/.env"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a && source "$ENV_FILE" && set +a
fi

ACTUAL_DATA_DIR="${ACTUAL_DATA_DIR:-/srv/actual/data}"

log() {
  printf '%s %s\n' "$(date -Is)" "$*"
}

die() {
  log "ERROR: $*" >&2
  exit 1
}

compose() {
  docker compose --file "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

# notify <title> <message> [priority]
# Best-effort: a failed notification must never fail a deploy or a backup.
notify() {
  local title="$1" message="$2" priority="${3:-default}"
  log "$title: $message"
  [[ -n "${NTFY_TOPIC:-}" ]] || return 0
  curl --silent --show-error --max-time 10 \
    --header "Title: $title" \
    --header "Priority: $priority" \
    --data "$message" \
    "${NTFY_SERVER:-https://ntfy.sh}/$NTFY_TOPIC" >/dev/null || true
}

# Poll the server's own /health endpoint until it answers or we run out of time.
wait_for_health() {
  local timeout="${1:-90}" deadline
  deadline=$(( $(date +%s) + timeout ))
  while (( $(date +%s) < deadline )); do
    if compose exec -T actual node scripts/health-check.js >/dev/null 2>&1; then
      return 0
    fi
    sleep 3
  done
  return 1
}

# Persist a key back into deploy/.env so a reboot or a manual `up -d` reproduces
# whatever state the last rollout left behind.
set_env() {
  local key="$1" value="$2"
  [[ -f "$ENV_FILE" ]] || die "missing $ENV_FILE"
  if grep --quiet "^${key}=" "$ENV_FILE"; then
    sed --in-place "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >>"$ENV_FILE"
  fi
}

# Immutable reference (repo@sha256:...) for a pulled tag. Matches on the repo
# rather than taking RepoDigests[0], which can belong to a different repo when
# an image carries several tags.
resolve_digest() {
  local ref="$1" repo="${1%:*}"
  docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$ref" 2>/dev/null \
    | grep "^${repo}@" \
    | head -1 \
    || true
}
