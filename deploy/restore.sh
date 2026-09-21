#!/usr/bin/env bash
# Explicit recovery operation: restore a selected backup after reviewing data loss.
set -Eeuo pipefail
umask 077
[[ $EUID -eq 0 && $# -eq 2 && $2 == --confirm-replace ]] || { echo 'Usage: sudo bash restore.sh BACKUP.sqlite --confirm-replace'; exit 1; }
source=$(realpath "$1")
[[ -f "$source" && "$source" != /var/lib/telo365/telo365.sqlite ]]
node=/opt/telo365/node/bin/node
admin=/opt/telo365/current/server/admin.mjs
"$node" "$admin" verify-backup "$source"
systemctl stop telo365-backup.timer telo365-backup.service telo365-monitor.timer telo365-monitor.service
systemctl stop telo365.service
saved=$(mktemp -d /var/backups/telo365/pre-restore.XXXXXXXX)
chmod 700 "$saved"
cp -a /var/lib/telo365/. "$saved/"
rollback() {
    trap - ERR
    systemctl stop telo365.service || true
    rm -f /var/lib/telo365/telo365.sqlite /var/lib/telo365/telo365.sqlite-wal /var/lib/telo365/telo365.sqlite-shm /var/lib/telo365/restored.sqlite
    cp -a "$saved/." /var/lib/telo365/
    systemctl start telo365.service telo365-backup.timer telo365-monitor.timer
    echo 'Restore failed; previous data restored.' >&2
}
trap rollback ERR
"$node" "$admin" restore-copy "$source" /var/lib/telo365/restored.sqlite
chown telo365:telo365 /var/lib/telo365/restored.sqlite
chmod 600 /var/lib/telo365/restored.sqlite
rm -f /var/lib/telo365/telo365.sqlite-wal /var/lib/telo365/telo365.sqlite-shm
mv -f /var/lib/telo365/restored.sqlite /var/lib/telo365/telo365.sqlite
# Restored session tokens must never become valid again.
runuser -u telo365 -- "$node" --input-type=module -e "import {DatabaseSync} from 'node:sqlite'; const db=new DatabaseSync('/var/lib/telo365/telo365.sqlite'); db.exec('DELETE FROM sessions'); db.close();"
systemctl start telo365.service
healthy=0
for attempt in {1..20}; do
    if curl --fail --silent http://127.0.0.1:1435/api/health; then healthy=1;break;fi
    sleep 1
done
[[ $healthy == 1 ]]
systemctl start telo365-backup.timer telo365-monitor.timer
trap - ERR
echo "Restored. Previous state: $saved"
echo 'Review account deletions made after the backup and reapply them before reopening access.'
