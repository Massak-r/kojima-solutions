<?php
require_once __DIR__ . '/_bootstrap.php';

// Public endpoint — validates the admin password and issues an HttpOnly
// session cookie. Acts as the server-side companion to the Vite-inlined
// VITE_ADMIN_PASSWORD flow: once the cookie is in place, future admin
// requests can authenticate without shipping the password in the bundle.

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('POST only', 405);

if (!defined('ADMIN_PASSWORD') || ADMIN_PASSWORD === '') {
    fail('Admin login not configured on the server.', 503);
}

// ── Rate limit per IP ───────────────────────────────────────────────
(function () {
    $ip = $_SERVER['HTTP_CF_CONNECTING_IP']
        ?? explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '')[0]
        ?? $_SERVER['REMOTE_ADDR']
        ?? 'unknown';
    $ip = trim($ip);
    if ($ip === '') $ip = 'unknown';

    $windowSec   = 900; // 15 min
    $maxAttempts = 10;

    $dir = sys_get_temp_dir() . '/kojima_rl';
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    $path = $dir . '/admin_login_' . hash('sha256', $ip);

    $now  = time();
    $data = ['start' => $now, 'count' => 0];
    $fh   = @fopen($path, 'c+');
    if (!$fh) return;
    @flock($fh, LOCK_EX);
    $raw = stream_get_contents($fh);
    if ($raw) {
        $parsed = json_decode($raw, true);
        if (is_array($parsed) && isset($parsed['start'], $parsed['count'])) {
            $data = $parsed;
        }
    }
    if ($now - (int)$data['start'] > $windowSec) {
        $data = ['start' => $now, 'count' => 0];
    }
    $data['count'] = (int)$data['count'] + 1;
    if ($data['count'] > $maxAttempts) {
        $retryAfter = max(1, $windowSec - ($now - (int)$data['start']));
        header('Retry-After: ' . $retryAfter);
        @flock($fh, LOCK_UN);
        @fclose($fh);
        http_response_code(429);
        echo json_encode(['error' => 'Trop de tentatives. Réessayez plus tard.']);
        exit;
    }
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($data));
    fflush($fh);
    @flock($fh, LOCK_UN);
    @fclose($fh);
})();

$d = body();
$password = (string)($d['password'] ?? '');

if (!hash_equals((string)ADMIN_PASSWORD, $password)) {
    fail('Mot de passe incorrect', 401);
}

// ── Ensure session table exists ─────────────────────────────────────
try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS admin_sessions (
            token       VARCHAR(64) PRIMARY KEY,
            created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at  DATETIME NOT NULL,
            revoked_at  DATETIME DEFAULT NULL,
            user_agent  VARCHAR(255) DEFAULT NULL,
            INDEX idx_expires (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
} catch (Throwable $e) {}

$token     = bin2hex(random_bytes(32));
$expiresAt = (new DateTime('+30 days'))->format('Y-m-d H:i:s');
$ua        = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255);

$pdo->prepare('INSERT INTO admin_sessions (token, expires_at, user_agent) VALUES (?, ?, ?)')
    ->execute([$token, $expiresAt, $ua]);

// HttpOnly + SameSite=Lax: not sent on cross-site iframe POSTs, not readable by JS.
// Secure flag on HTTPS only (auto-detect on the deployed host).
$secure = ($_SERVER['HTTPS'] ?? '') !== '' || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
setcookie('kojima_admin_session', $token, [
    'expires'  => strtotime($expiresAt),
    'path'     => '/',
    'secure'   => $secure,
    'httponly' => true,
    'samesite' => 'Lax',
]);

// CSRF double-submit cookie: JS-readable so the SPA can echo it back as the
// X-CSRF-Token header on writes. Same expiry as the session.
$csrfToken = bin2hex(random_bytes(32));
setcookie('kojima_csrf', $csrfToken, [
    'expires'  => strtotime($expiresAt),
    'path'     => '/',
    'secure'   => $secure,
    'httponly' => false,
    'samesite' => 'Lax',
]);

ok(['ok' => true, 'expiresAt' => $expiresAt]);
