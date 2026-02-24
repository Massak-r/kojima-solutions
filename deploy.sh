#!/usr/bin/env bash
set -e  # stop immediately on any error

# ── Configure these once ──────────────────────────────────────
SSH_USER="your_cpanel_username"
SSH_HOST="your-domain.com"           # or your server IP address
REMOTE_PATH="/home/your_cpanel_username/public_html"
SSH_PORT=22                          # change if your host uses a different port
# ─────────────────────────────────────────────────────────────

echo ""
echo "▶  Building Kojima Solutions..."
npm run build

echo ""
echo "▶  Uploading to ${SSH_USER}@${SSH_HOST}:${REMOTE_PATH} ..."
scp -r -P ${SSH_PORT} dist/* "${SSH_USER}@${SSH_HOST}:${REMOTE_PATH}/"

echo ""
echo "✅  Deployed successfully!"
echo "    https://${SSH_HOST}"
echo ""
