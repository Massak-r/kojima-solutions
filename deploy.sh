#!/usr/bin/env bash
set -e  # stop immediately on any error

# ── Configure these once ──────────────────────────────────────
SSH_USER="lhwd_automated"
SSH_HOST="lhwd.ftp.infomaniak.com"
REMOTE_PATH="/home/clients/ba8c9a93b5cde03c1f26b6ea1c83c339/sites/kojima-solutions.ch"
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
echo "▶  Ensuring uploads/ directory exists on server ..."
ssh -p ${SSH_PORT} "${SSH_USER}@${SSH_HOST}" "mkdir -p ${REMOTE_PATH}/uploads && chmod 755 ${REMOTE_PATH}/uploads"

echo ""
echo "✅  Deployed successfully!"
echo "    https://kojima-solutions.ch"
echo ""
echo "  ⚠️  If this is first deploy with DB support:"
echo "     1. Create MariaDB in Infomaniak Manager"
echo "     2. Import schema:  mysql -h HOST -u USER -p DB < database/schema.sql"
echo "     3. Create config:  ${REMOTE_PATH}/api/config.php  (see config.example.php)"
echo ""
