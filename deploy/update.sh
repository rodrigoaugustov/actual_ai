#!/usr/bin/env bash
#
# Pull-based continuous deployment.
#
# The host has no inbound port — CI cannot reach in, so the host reaches out.
# That also avoids a self-hosted GitHub runner, which the GitHub docs warn
# against on public repositories: any third-party pull request would execute
# code on this machine.
#
# Run by a systemd timer. Safe to run by hand at any time; it is a no-op when
# the published image already matches the running one.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

CHANNEL_REF="${ACTUAL_CHANNEL_REF:-ghcr.io/rodrigoaugustov/actual-ai:master}"
LAST_GOOD="$DEPLOY_DIR/.last-good"
BLOCKED="$DEPLOY_DIR/.blocked"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"

# The timer fires every couple of minutes; a slow rollout must not overlap with
# the next tick.
exec 9>"$DEPLOY_DIR/.update.lock"
flock --nonblock 9 || { log "another update is in progress, skipping"; exit 0; }

log "checking $CHANNEL_REF"
docker pull --quiet "$CHANNEL_REF" >/dev/null || die "pull failed"

NEW_REF="$(resolve_digest "$CHANNEL_REF")"
[[ -n "$NEW_REF" ]] || die "could not resolve a digest for $CHANNEL_REF"

CURRENT_REF="${ACTUAL_IMAGE:-}"

if [[ "$NEW_REF" == "$CURRENT_REF" ]]; then
  log "already on $NEW_REF, nothing to do"
  exit 0
fi

# Quarantine. Without this, an image that fails its health check gets rolled
# back and then reinstalled on the next tick, forever. The block clears itself
# as soon as a different digest is published.
if [[ -f "$BLOCKED" && "$(cat "$BLOCKED")" == "$NEW_REF" ]]; then
  log "$NEW_REF previously failed to become healthy; waiting for a new build"
  exit 0
fi
rm --force "$BLOCKED"

log "new image available: $NEW_REF (was ${CURRENT_REF:-none})"

# Snapshot before touching anything. This deliberately aborts the rollout if it
# fails: the client-side migrations that ship with a new bundle rewrite the
# budget file and sync those changes up, so "deploy first, back up later" is not
# a recoverable ordering for financial data.
if ! "$DEPLOY_DIR/backup.sh" pre-deploy; then
  notify "Deploy ABORTED" "Pre-deploy backup failed; staying on ${CURRENT_REF:-current image}." high
  die "pre-deploy backup failed"
fi

# Not `[[ ... ]] && ...`: under `set -e` a false test would abort the rollout.
if [[ -n "$CURRENT_REF" ]]; then
  printf '%s\n' "$CURRENT_REF" >"$LAST_GOOD"
fi

log "rolling out"
set_env ACTUAL_IMAGE "$NEW_REF"
export ACTUAL_IMAGE="$NEW_REF"

if ! compose up --detach actual; then
  printf '%s\n' "$NEW_REF" >"$BLOCKED"
  notify "Deploy FAILED" "compose up failed for $NEW_REF; rolling back." high
  "$DEPLOY_DIR/rollback.sh" || notify "Rollback FAILED" "Manual intervention needed." urgent
  exit 1
fi

if wait_for_health "$HEALTH_TIMEOUT"; then
  log "healthy on $NEW_REF"
  # Keep a week of images so a manual rollback further back stays possible,
  # without letting the boot volume fill up.
  docker image prune --force --filter 'until=168h' >/dev/null 2>&1 || true
  notify "Deploy OK" "Now running ${NEW_REF##*@}"
  exit 0
fi

printf '%s\n' "$NEW_REF" >"$BLOCKED"
notify "Deploy FAILED" "$NEW_REF never became healthy in ${HEALTH_TIMEOUT}s; rolling back." high
if "$DEPLOY_DIR/rollback.sh"; then
  notify "Rolled back" "Restored ${CURRENT_REF##*@}. Push a fix — this digest is quarantined until a new build appears."
else
  notify "Rollback FAILED" "Manual intervention needed on the host." urgent
fi
exit 1
