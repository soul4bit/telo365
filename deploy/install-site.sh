#!/usr/bin/env bash
# Run on the dedicated TELO365 Ubuntu VM. No Node.js runtime required.
set -euo pipefail
umask 022
[[ $EUID -eq 0 && $# -eq 2 ]] || { echo 'Usage: sudo bash install-site.sh SITE.tar.gz EDGE_IPV4'; exit 1; }
archive=$(realpath "$1")
edge=$2
python3 - "$edge" <<'PY'
import ipaddress, sys
ipaddress.IPv4Address(sys.argv[1])
PY
[[ -f "$archive" ]] || { echo 'Site archive not found'; exit 1; }
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx curl
base=/var/www/telo365
conf=/etc/nginx/conf.d/telo365-origin.conf
if [[ -e "$conf" ]] && ! head -1 "$conf" | grep -Fxq '# Managed TELO365 origin'; then
    echo 'Refusing to overwrite an unmanaged nginx configuration'; exit 1
fi
install -d -m 755 "$base/releases"
release=$(mktemp -d "$base/releases/site.XXXXXXXX")
chmod 755 "$release"
python3 - "$archive" "$release" <<'PY'
import pathlib, sys, tarfile
with tarfile.open(sys.argv[1], 'r:gz') as archive:
    members = archive.getmembers()
    if sum(m.size for m in members) > 200_000_000:
        raise SystemExit('Archive exceeds 200 MB')
    for m in members:
        p = pathlib.PurePosixPath(m.name)
        if p.is_absolute() or '..' in p.parts or not p.parts or p.parts[0] != 'dist' or not (m.isfile() or m.isdir()):
            raise SystemExit('Unsafe archive member: ' + m.name)
    archive.extractall(sys.argv[2], members=members, filter='data')
if not (pathlib.Path(sys.argv[2]) / 'dist/index.html').is_file():
    raise SystemExit('Missing dist/index.html')
PY
find "$release" -type d -exec chmod 755 {} +
find "$release" -type f -exec chmod 644 {} +
previous=$(readlink "$base/current" || true)
[[ ! -e "$base/current" || -L "$base/current" ]] || { echo 'current must be a symlink'; exit 1; }
[[ ! -f "$conf" ]] || cp -p "$conf" "$release/previous-nginx.conf"
rollback() {
    if [[ -n "$previous" ]]; then ln -sfn "$previous" "$base/current"; else rm -f "$base/current"; fi
    if [[ -f "$release/previous-nginx.conf" ]]; then cp -p "$release/previous-nginx.conf" "$conf"; else rm -f "$conf"; fi
    nginx -t && systemctl reload nginx || true
}
trap rollback ERR
cat > "$conf" <<EOF
# Managed TELO365 origin
server {
    listen 8080;
    server_name telo365.ru www.telo365.ru;
    root $base/current;
    index index.html;
    server_tokens off;
    allow $edge;
    allow 127.0.0.1;
    deny all;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    location = /healthz { default_type text/plain; try_files /healthz =404; }
    location ~ /\. { deny all; }
    location /assets/ { expires 1y; try_files \$uri =404; }
    location /images/ { expires 7d; try_files \$uri =404; }
    location / { expires -1; try_files \$uri \$uri/ /index.html; }
}
EOF
printf 'ok\n' > "$release/dist/healthz"
ln -s "$release/dist" "$base/current.next"
mv -Tf "$base/current.next" "$base/current"
nginx -t
systemctl enable --now nginx
systemctl reload nginx
curl --fail --silent http://127.0.0.1:8080/healthz
trap - ERR
printf '\nInstalled: %s\nPrevious: %s\n' "$release/dist" "${previous:-none}"
echo 'Only the edge server and localhost can access port 8080. Check existing UFW rules separately.'
