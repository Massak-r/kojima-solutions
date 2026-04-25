<?php
// Copy this file to config.php on the server and fill in real credentials.
// config.php is gitignored — never commit credentials.

define('DB_HOST', 'localhost');     // Usually 'localhost' on Infomaniak
define('DB_NAME', 'lhwd_kojima');   // Database name from Infomaniak Manager
define('DB_USER', 'lhwd_kojima');   // DB user from Infomaniak Manager
define('DB_PASS', 'YOUR_PASSWORD'); // DB password you set in Infomaniak Manager
define('SITE_URL', 'https://kojima-solutions.ch'); // No trailing slash
define('ADMIN_EMAIL', 'chraiti.massaki@gmail.com'); // Receives client feedback notifications
define('CRON_KEY',   '');                          // Optional: secret key to protect digest.php URL (leave empty to disable check)
define('API_SECRET', '');                          // Required: secret key sent by frontend as X-API-Key header
define('ADMIN_PASSWORD', '');                      // Required for server-validated admin login. Set to the same value you put in .env VITE_ADMIN_PASSWORD during transition; rotate when the cookie flow is the only path.
define('ANALYTICS_SECRET', '');                    // Secret for daily visitor hash (analytics privacy)

// ── Web Push (VAPID) ────────────────────────────────────────────
// Generate keys: openssl ecparam -genkey -name prime256v1 -noout | openssl ec -text -noout
// Then base64url-encode the private key (32 bytes) and public key (65 bytes uncompressed)
define('VAPID_PUBLIC_KEY',  '');  // Base64url-encoded 65-byte uncompressed public key
define('VAPID_PRIVATE_KEY', '');  // Base64url-encoded 32-byte private key
define('VAPID_SUBJECT',     'mailto:chraiti.massaki@gmail.com');

// ── Google Calendar API ──────────────────────────────────────────
// 1. Create a Google Cloud project → Enable Calendar API → Create Service Account
// 2. Download the JSON key file and place it OUTSIDE the web root
// 3. Share your calendar with the service account email (e.g. xyz@project.iam.gserviceaccount.com)
define('GOOGLE_SA_KEY_PATH', '/home/clients/ba8c9a93b5cde03c1f26b6ea1c83c339/private/google-sa-key.json');
define('GOOGLE_CALENDAR_ID', 'chraiti.massaki@gmail.com');
