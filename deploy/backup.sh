#!/usr/bin/env bash
#
# Encrypted offsite backup of the Actual data volume.
#
#   ./backup.sh              # routine backup (systemd timer, daily)
#   ./backup.sh pre-deploy   # snapshot taken by update.sh before a rollout
#
# Two things here are deliberate and worth not "simplifying" later:
#
#   * SQLite files are copied with `.backup`, not `cp`. The server is running
#     and the databases are in WAL mode; a plain copy can capture a torn file
#     that looks fine until the day you need it.
#   * The archive is encrypted before it leaves the host. It contains the
#     `secrets` table of account.sqlite, which holds the Anthropic API key and
#     the Pluggy credentials in plaintext.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

LABEL="${1:-daily}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE="actual-${STAMP}-${LABEL}.tar.age"
REMOTE="${RCLONE_REMOTE:-r2}:${RCLONE_BUCKET:-actual-backups}"

[[ -n "${AGE_RECIPIENT:-}" ]] || die "AGE_RECIPIENT is not set — refusing to write an unencrypted backup"
[[ -d "$ACTUAL_DATA_DIR" ]] || die "data directory not found: $ACTUAL_DATA_DIR"

for tool in sqlite3 age rclone rsync; do
  command -v "$tool" >/dev/null || die "$tool is not installed"
done

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
STAGE="$WORK/data"
ARCHIVE_PATH="$WORK/$ARCHIVE"
mkdir -p "$STAGE"

log "staging $ACTUAL_DATA_DIR"

# Consistent copies of every SQLite database, preserving relative layout.
while IFS= read -r -d '' db; do
  rel="${db#"$ACTUAL_DATA_DIR"/}"
  mkdir -p "$STAGE/$(dirname "$rel")"
  sqlite3 "$db" ".backup '$STAGE/$rel'" || die "sqlite3 .backup failed for $rel"
  log "  snapshot $rel"
done < <(find "$ACTUAL_DATA_DIR" -type f -name '*.sqlite' -print0)

# Everything that is not a database (budget blobs, config.json) copied as-is.
# The -wal/-shm sidecars are excluded on purpose: `.backup` already folded them
# into the snapshots above, and shipping them would produce an inconsistent set.
rsync --archive \
  --exclude '*.sqlite' --exclude '*.sqlite-wal' --exclude '*.sqlite-shm' \
  "$ACTUAL_DATA_DIR"/ "$STAGE"/

log "encrypting to $ARCHIVE"
tar --create --gzip --directory "$STAGE" . \
  | age --recipient "$AGE_RECIPIENT" --output "$ARCHIVE_PATH"

SIZE="$(du -h "$ARCHIVE_PATH" | cut -f1)"

log "uploading to $REMOTE/$LABEL/"
rclone copyto "$ARCHIVE_PATH" "$REMOTE/$LABEL/$ARCHIVE" || die "upload failed"

# Sundays get promoted to the weekly set, which is pruned far more slowly.
if [[ "$LABEL" == "daily" && "$(date -u +%u)" == "7" ]]; then
  rclone copyto "$REMOTE/daily/$ARCHIVE" "$REMOTE/weekly/$ARCHIVE" || true
fi

# prune <prefix> <keep>
prune() {
  local prefix="$1" keep="$2" total
  local -a files
  mapfile -t files < <(rclone lsf "$REMOTE/$prefix/" 2>/dev/null | sort)
  total=${#files[@]}
  (( total > keep )) || return 0
  for f in "${files[@]:0:$(( total - keep ))}"; do
    log "  pruning $prefix/$f"
    rclone deletefile "$REMOTE/$prefix/$f" || true
  done
}

prune daily 14
prune weekly 8
prune pre-deploy 5

notify "Backup OK" "$ARCHIVE ($SIZE) → $REMOTE/$LABEL/"
log "done"
