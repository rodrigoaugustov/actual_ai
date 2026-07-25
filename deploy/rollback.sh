#!/usr/bin/env bash
#
# Restore the previously known-good image.
#
#   ./rollback.sh                        # back to deploy/.last-good
#   ./rollback.sh ghcr.io/...@sha256:..  # back to a specific digest
#
# Called automatically by update.sh when a rollout fails its health check, and
# usable by hand when a deploy is healthy but wrong.
#
# This rolls back CODE only. If the bad release carried a client-side migration
# and you already opened the budget on any device, the budget file has advanced
# and you need restore.sh as well — see the runbook.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

LAST_GOOD="$DEPLOY_DIR/.last-good"
TARGET="${1:-}"

if [[ -z "$TARGET" ]]; then
  [[ -f "$LAST_GOOD" ]] || die "no $LAST_GOOD to roll back to; pass a reference explicitly"
  TARGET="$(cat "$LAST_GOOD")"
fi

[[ -n "$TARGET" ]] || die "empty rollback target"

log "rolling back to $TARGET"

docker pull --quiet "$TARGET" >/dev/null || die "could not pull $TARGET"

set_env ACTUAL_IMAGE "$TARGET"
export ACTUAL_IMAGE="$TARGET"

compose up --detach actual || die "compose up failed for $TARGET"

if wait_for_health "${HEALTH_TIMEOUT:-120}"; then
  log "healthy on $TARGET"
  exit 0
fi

die "$TARGET did not become healthy either — the host needs manual attention"
