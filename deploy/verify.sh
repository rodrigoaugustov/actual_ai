#!/usr/bin/env bash
#
# Post-deploy checks.
#
#   ./verify.sh                       # remote checks against the public hostname
#   ./verify.sh --host                # adds container/timer checks (run on the VM)
#
# Exits non-zero if anything fails, so it can gate a deploy or run from cron.

set -uo pipefail

HOSTNAME_FQDN="${HOSTNAME_FQDN:-financas.caderninho-digital.com}"
BASE="https://$HOSTNAME_FQDN"
ON_HOST=0
[[ "${1:-}" == "--host" ]] && ON_HOST=1

pass=0; fail=0
ok()   { printf '  \033[32mok\033[0m   %s\n' "$*"; pass=$(( pass + 1 )); }
bad()  { printf '  \033[31mFAIL\033[0m %s\n' "$*"; fail=$(( fail + 1 )); }
head_() { printf '\n\033[1m%s\033[0m\n' "$*"; }

head_ "Reachability"
HEADERS="$(curl --silent --show-error --max-time 20 --dump-header - --output /dev/null "$BASE" 2>&1)" \
  && ok "$BASE responds" \
  || { bad "$BASE unreachable"; echo "$HEADERS" | head -3; }

STATUS="$(grep --max-count=1 --only-matching --extended-regexp '^HTTP/[0-9.]+ [0-9]{3}' <<<"$HEADERS" | grep --only-matching '[0-9]\{3\}$')"
[[ "$STATUS" == "200" ]] && ok "HTTP $STATUS" || bad "HTTP ${STATUS:-none} (expected 200)"

head_ "Cross-origin isolation"
# The app needs SharedArrayBuffer for its in-browser SQLite. A DUPLICATED header
# is the classic reverse-proxy failure and browsers reject it outright, so count
# occurrences rather than just grepping for presence.
for h in cross-origin-opener-policy cross-origin-embedder-policy; do
  n="$(grep --count --ignore-case "^$h:" <<<"$HEADERS" || true)"
  v="$(grep --max-count=1 --ignore-case "^$h:" <<<"$HEADERS" | tr -d '\r' | cut -d' ' -f2-)"
  case "$n" in
    1) ok "$h: $v" ;;
    0) bad "$h missing — SharedArrayBuffer will fail on mobile" ;;
    *) bad "$h appears $n times ('$v') — browsers reject duplicates" ;;
  esac
done

head_ "Health"
HEALTH="$(curl --silent --max-time 20 "$BASE/health")"
[[ "$(jq -r '.status // empty' <<<"$HEALTH" 2>/dev/null)" == "UP" ]] \
  && ok "/health -> UP" \
  || bad "/health -> ${HEALTH:-no response}"

head_ "No injected scripts"
# Rocket Loader / Auto Minify inject inline script, which the production CSP
# (no 'unsafe-inline') rejects, producing a blank page.
BODY="$(curl --silent --max-time 20 "$BASE")"
grep --quiet --ignore-case 'rocket-loader\|cf_rl' <<<"$BODY" \
  && bad "Rocket Loader is injecting into the page — turn it off for this hostname" \
  || ok "no Rocket Loader injection"

if (( ON_HOST )); then
  DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

  head_ "Container"
  STATE="$(docker inspect --format '{{.State.Health.Status}}' \
    "$(docker compose --file "$DEPLOY_DIR/compose.prod.yml" --env-file "$DEPLOY_DIR/.env" ps --quiet actual)" 2>/dev/null)"
  [[ "$STATE" == "healthy" ]] && ok "actual is $STATE" || bad "actual is ${STATE:-not running}"

  head_ "Timers"
  for t in actual-update.timer actual-backup.timer; do
    systemctl is-active --quiet "$t" && ok "$t active" || bad "$t inactive"
  done

  head_ "Data ownership"
  # The container runs as uid 1001 and cannot fix this itself.
  OWNER="$(stat -c '%u:%g' "${ACTUAL_DATA_DIR:-/srv/actual/data}" 2>/dev/null)"
  [[ "$OWNER" == "1001:1001" ]] && ok "data dir owned by 1001:1001" || bad "data dir owned by ${OWNER:-?} (expected 1001:1001)"

  head_ "Backups"
  if [[ -f "$DEPLOY_DIR/.env" ]]; then
    # shellcheck disable=SC1091
    set -a && source "$DEPLOY_DIR/.env" && set +a
    COUNT="$(rclone lsf "${RCLONE_REMOTE:-r2}:${RCLONE_BUCKET:-actual-backups}/daily/" 2>/dev/null | wc -l)"
    (( COUNT > 0 )) && ok "$COUNT daily backup(s) in R2" || bad "no backups in R2 yet"
  fi
fi

printf '\n%d passed, %d failed\n' "$pass" "$fail"
exit $(( fail > 0 ? 1 : 0 ))
