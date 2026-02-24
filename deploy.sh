#!/usr/bin/env bash
set -e  # stop immediately on any error

# ── Configure these once ──────────────────────────────────────
SSH_USER="lhwd_automated"
SSH_HOST="lhwd.ftp.infomaniak.com"
REMOTE_PATH="/home/clients/ba8c9a93b5cde03c1f26b6ea1c83c339/web"
SSH_PORT=22
# ─────────────────────────────────────────────────────────────

echo ""
echo "▶  Building Kojima Solutions..."
npm run build

echo ""
echo "▶  Uploading to ${SSH_USER}@${SSH_HOST}:${REMOTE_PATH} ..."
# Upload all files (dist/* misses hidden files like .htaccess, so we do both)
scp -r -P ${SSH_PORT} dist/* "${SSH_USER}@${SSH_HOST}:${REMOTE_PATH}/"
scp -P ${SSH_PORT} dist/.htaccess "${SSH_USER}@${SSH_HOST}:${REMOTE_PATH}/.htaccess"

echo ""
echo "✅  Deployed successfully!"
echo "    https://kojima-solutions.ch"
echo ""
