#!/usr/bin/env bash
#
# Restore an encrypted backup produced by backup.sh.
#
#   ./restore.sh --list
#   ./restore.sh <archive> --into /tmp/drill     # rehearsal, nothing touched
#   ./restore.sh <archive> --into "$ACTUAL_DATA_DIR" --force   # the real thing
#
# The private age key is NOT on this host by design. Provide it for the length
# of the restore only:
#
#   AGE_IDENTITY=/path/to/key.txt ./restore.sh ...
#
# Do the rehearsal at least once. A backup you have never restored is a guess.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

REMOTE="${RCLONE_REMOTE:-r2}:${RCLONE_BUCKET:-actual-backups}"

ARCHIVE=""
TARGET=""
FORCE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --list)
      for prefix in daily weekly pre-deploy; do
        printf '\n== %s ==\n' "$prefix"
        rclone lsl "$REMOTE/$prefix/" 2>/dev/null || true
      done
      exit 0
      ;;
    --into) TARGET="$2"; shift 2 ;;
    --force) FORCE=1; shift ;;
    -*) die "unknown option: $1" ;;
    *) ARCHIVE="$1"; shift ;;
  esac
done

[[ -n "$ARCHIVE" ]] || die "no archive given; run --list to see what exists"
[[ -n "$TARGET" ]] || die "--into is required (use a scratch directory to rehearse)"
[[ -n "${AGE_IDENTITY:-}" ]] || die "AGE_IDENTITY must point at the private age key"
[[ -f "$AGE_IDENTITY" ]] || die "no such key file: $AGE_IDENTITY"

# Restoring onto the live data directory replaces the budget and every stored
# credential, so it needs both an explicit flag and a stopped server.
if [[ "$(readlink --canonicalize "$TARGET")" == "$(readlink --canonicalize "$ACTUAL_DATA_DIR")" && "$FORCE" != "1" ]]; then
  die "refusing to overwrite the live data directory without --force"
fi

# Find the archive under whichever prefix holds it.
SOURCE=""
for prefix in daily weekly pre-deploy; do
  if rclone lsf "$REMOTE/$prefix/$ARCHIVE" >/dev/null 2>&1; then
    SOURCE="$REMOTE/$prefix/$ARCHIVE"
    break
  fi
done
[[ -n "$SOURCE" ]] || die "$ARCHIVE not found under daily/, weekly/ or pre-deploy/"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

log "downloading $SOURCE"
rclone copyto "$SOURCE" "$WORK/$ARCHIVE" || die "download failed"

log "decrypting"
age --decrypt --identity "$AGE_IDENTITY" --output "$WORK/archive.tar.gz" "$WORK/$ARCHIVE" \
  || die "decryption failed — wrong key?"

if [[ "$FORCE" == "1" ]]; then
  log "stopping the server before overwriting live data"
  compose stop actual || true
fi

mkdir --parents "$TARGET"
log "extracting into $TARGET"
tar --extract --gzip --directory "$TARGET" --file "$WORK/archive.tar.gz"

# The container runs as uid 1001 and cannot fix ownership itself.
if [[ "$FORCE" == "1" ]]; then
  chown --recursive 1001:1001 "$TARGET"
  log "starting the server"
  compose up --detach actual
  wait_for_health "${HEALTH_TIMEOUT:-120}" || die "server did not come back healthy"
fi

log "restored into $TARGET"
printf '\nContents:\n'
find "$TARGET" -maxdepth 2 -type f | head -20
