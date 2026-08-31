#!/usr/bin/env bash
# Xiaorili sync server deploy script for Ubuntu/Debian.
# Usage:
#   sudo DOMAIN=sync.example.com ./scripts/deploy-sync-server.sh
# Optional env vars:
#   APP_DIR=/opt/xiaorili-sync
#   DATA_DIR=/var/lib/xiaorili
#   SYNC_USER=xiaorili
#   PORT=8787
#   SMS_DEV_MODE=true
#   INSTALL_HTTPS=auto   # auto: enabled when DOMAIN is set
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "请使用 sudo 运行此脚本" >&2
  exit 1
fi

APP_DIR="${APP_DIR:-/opt/xiaorili-sync}"
DATA_DIR="${DATA_DIR:-/var/lib/xiaorili}"
SYNC_USER="${SYNC_USER:-xiaorili}"
PORT="${PORT:-8787}"
SMS_DEV_MODE="${SMS_DEV_MODE:-true}"
DOMAIN="${DOMAIN:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> 安装 Node.js 20"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get update -y
  apt-get install -y nodejs
fi

echo "==> 创建运行用户和目录"
id -u "$SYNC_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$SYNC_USER"
mkdir -p "$APP_DIR" "$DATA_DIR"
cp "$SCRIPT_DIR/../sync-server.cjs" "$APP_DIR/sync-server.cjs"
cp "$SCRIPT_DIR/xiaorili-sync.service" "$APP_DIR/xiaorili-sync.service.template"
chown -R "$SYNC_USER:$SYNC_USER" "$APP_DIR" "$DATA_DIR"

echo "==> 写入 systemd 服务"
sed \
  -e "s|{{SYNC_USER}}|$SYNC_USER|g" \
  -e "s|{{APP_DIR}}|$APP_DIR|g" \
  -e "s|{{DATA_DIR}}|$DATA_DIR|g" \
  -e "s|{{PORT}}|$PORT|g" \
  -e "s|{{SMS_DEV_MODE}}|$SMS_DEV_MODE|g" \
  "$APP_DIR/xiaorili-sync.service.template" > /etc/systemd/system/xiaorili-sync.service
rm -f "$APP_DIR/xiaorili-sync.service.template"
systemctl daemon-reload
systemctl enable xiaorili-sync
systemctl restart xiaorili-sync

echo "==> 等待服务启动"
for _ in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
curl -fsS "http://127.0.0.1:$PORT/health"

if [[ -n "$DOMAIN" ]]; then
  if [[ "${INSTALL_HTTPS:-auto}" != "no" ]]; then
    echo "==> 安装 Caddy 并配置 HTTPS"
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
    apt-get update -y
    apt-get install -y caddy
    cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
	reverse_proxy 127.0.0.1:$PORT
}
EOF
    systemctl reload caddy
    echo "==> HTTPS 地址: https://$DOMAIN"
  fi
fi

echo ""
echo "==> 部署完成"
echo "服务地址: http://<服务器公网IP>:$PORT"
echo "请在客户端“同步服务器”设置中填写以上 HTTPS 或公网地址并保存"
