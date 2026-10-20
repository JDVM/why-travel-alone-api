#!/usr/bin/env bash
# Backs up the database to a compressed, timestamped SQL file and removes
# backups older than BACKUP_KEEP_DAYS.
#
#   scripts/backup-db.sh                      # reads DB_* from the environment
#   BACKUP_DIR=/backups scripts/backup-db.sh
#
# Uses the same DB_HOST, DB_PORT, DB_LOCAL_DBNAME, DB_LOCAL_USER and
# DB_LOCAL_PASSWORD as the API. Needs mysqldump 8 (the mysql client tools).
# --single-transaction takes a consistent snapshot without locking the tables,
# so it is safe to run while the site is live.
set -euo pipefail

: "${DB_LOCAL_DBNAME:?Set DB_LOCAL_DBNAME}"
: "${DB_LOCAL_USER:?Set DB_LOCAL_USER}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"

# Backups hold personal data: only the owner may read them.
umask 077
mkdir -p "$BACKUP_DIR"

# The password goes in a temporary options file, not on the command line,
# where other users could see it in the process list.
partial=""
options_file="$(mktemp)"
trap 'rm -f "$options_file" "$partial"' EXIT
printf '[client]\nhost=%s\nport=%s\nuser=%s\npassword="%s"\n' \
    "$DB_HOST" "$DB_PORT" "$DB_LOCAL_USER" "${DB_LOCAL_PASSWORD:-}" > "$options_file"
if [ "${DB_SSL:-}" = "true" ]; then
    printf 'ssl-mode=VERIFY_IDENTITY\n' >> "$options_file"
    if [ -n "${DB_SSL_CA:-}" ] && [ -f "$DB_SSL_CA" ]; then
        printf 'ssl-ca=%s\n' "$DB_SSL_CA" >> "$options_file"
    fi
fi

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$BACKUP_DIR/${DB_LOCAL_DBNAME}-${stamp}.sql.gz"
partial="$target.partial"

mysqldump --defaults-extra-file="$options_file" \
    --single-transaction --quick --routines --triggers \
    --no-tablespaces --set-gtid-purged=OFF \
    "$DB_LOCAL_DBNAME" | gzip -9 > "$partial"

# Only a complete dump gets the final name.
gzip -t "$partial"
mv "$partial" "$target"
echo "Backup written: $target ($(du -h "$target" | cut -f1))"

find "$BACKUP_DIR" -name "${DB_LOCAL_DBNAME}-*.sql.gz" -type f -mtime "+$BACKUP_KEEP_DAYS" -print -delete \
    | sed 's/^/Removed old backup: /'
