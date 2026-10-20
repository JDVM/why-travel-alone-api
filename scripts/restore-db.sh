#!/usr/bin/env bash
# Restores a backup made by backup-db.sh into a database, replacing its
# contents.
#
#   RESTORE_CONFIRM=<database name> scripts/restore-db.sh backups/wta-20261021T030000Z.sql.gz
#
# Restores into DB_LOCAL_DBNAME (with the same DB_* settings as the API).
# Practice by restoring into a scratch database first: set DB_LOCAL_DBNAME to
# an empty database, restore, and point a copy of the API at it.
set -euo pipefail

backup="${1:?Usage: RESTORE_CONFIRM=<database> $0 <backup.sql.gz>}"
: "${DB_LOCAL_DBNAME:?Set DB_LOCAL_DBNAME}"
: "${DB_LOCAL_USER:?Set DB_LOCAL_USER}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"

if [ "${RESTORE_CONFIRM:-}" != "$DB_LOCAL_DBNAME" ]; then
    echo "This replaces everything in the database '$DB_LOCAL_DBNAME' on $DB_HOST." >&2
    echo "Set RESTORE_CONFIRM=$DB_LOCAL_DBNAME to confirm." >&2
    exit 1
fi
gzip -t "$backup"

options_file="$(mktemp)"
trap 'rm -f "$options_file"' EXIT
printf '[client]\nhost=%s\nport=%s\nuser=%s\npassword="%s"\n' \
    "$DB_HOST" "$DB_PORT" "$DB_LOCAL_USER" "${DB_LOCAL_PASSWORD:-}" > "$options_file"
if [ "${DB_SSL:-}" = "true" ]; then
    printf 'ssl-mode=VERIFY_IDENTITY\n' >> "$options_file"
    if [ -n "${DB_SSL_CA:-}" ] && [ -f "$DB_SSL_CA" ]; then
        printf 'ssl-ca=%s\n' "$DB_SSL_CA" >> "$options_file"
    fi
fi

# The dump drops and recreates each table it contains.
gunzip -c "$backup" | mysql --defaults-extra-file="$options_file" "$DB_LOCAL_DBNAME"
echo "Restored $backup into $DB_LOCAL_DBNAME on $DB_HOST."
