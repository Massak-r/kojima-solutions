<?php
require_once __DIR__ . '/_bootstrap.php';

// No auth — public endpoint for client login by email

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') {
    fail('Method not allowed', 405);
}

// ── Rate limit (per IP, sliding 15 min window) ──────────────────────
// Lightweight file-based limiter; avoids a DB round-trip for the hot path
// and keeps working even if the rate_limits table doesn't exist yet.
(function () {
    $ip = $_SERVER['HTTP_CF_CONNECTING_IP']
        ?? explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '')[0]
        ?? $_SERVER['REMOTE_ADDR']
        ?? 'unknown';
    $ip = trim($ip);
    if ($ip === '') $ip = 'unknown';

    $windowSec   = 900;   // 15 min
    $maxAttempts = 10;

    $dir = sys_get_temp_dir() . '/kojima_rl';
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    $path = $dir . '/client_login_' . hash('sha256', $ip);

    $now  = time();
    $data = ['start' => $now, 'count' => 0];
    $fh   = @fopen($path, 'c+');
    if (!$fh) return; // if temp dir is unwritable, don't block login
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
$email = strtolower(trim($d['email'] ?? ''));

if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fail('Email invalide', 400);
}

// Find client(s) by email
$clientStmt = $pdo->prepare("SELECT id, name, organization, email FROM clients WHERE LOWER(email) = ?");
$clientStmt->execute([$email]);
$clients = $clientStmt->fetchAll();

if (empty($clients)) {
    fail('Aucun projet trouvé pour cet email', 404);
}

// Gather projects for all matching clients
$results = [];
foreach ($clients as $client) {
    $projStmt = $pdo->prepare("SELECT id, title, status, client_slug, updated_at FROM projects WHERE client_id = ? ORDER BY updated_at DESC");
    $projStmt->execute([$client['id']]);
    $projects = $projStmt->fetchAll();

    if (!empty($projects)) {
        $results[] = [
            'client' => [
                'id'           => $client['id'],
                'name'         => $client['name'],
                'organization' => $client['organization'],
            ],
            'projects' => array_map(fn($p) => [
                'id'         => $p['id'],
                'title'      => $p['title'],
                'status'     => $p['status'],
                'clientSlug' => $p['client_slug'],
                'lastActivity' => $p['updated_at'],
            ], $projects),
        ];
    }
}

if (empty($results)) {
    fail('Aucun projet trouvé pour cet email', 404);
}

// Issue an opaque session token tied to this client.
// Auto-migrate the table on first run (same pattern used elsewhere in this codebase).
try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS client_sessions (
            token       VARCHAR(64) PRIMARY KEY,
            client_id   VARCHAR(36) NOT NULL,
            created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at  DATETIME NOT NULL,
            revoked_at  DATETIME DEFAULT NULL,
            INDEX idx_client  (client_id),
            INDEX idx_expires (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
} catch (Throwable $e) {}

$sessionToken = bin2hex(random_bytes(32));
$expiresAt    = (new DateTime('+30 days'))->format('Y-m-d H:i:s');
try {
    $pdo->prepare('INSERT INTO client_sessions (token, client_id, expires_at) VALUES (?, ?, ?)')
        ->execute([$sessionToken, $results[0]['client']['id'], $expiresAt]);
} catch (Throwable $e) {
    // If session insert fails, continue without blocking login — client still has
    // the legacy email-based flow. Infrastructure-first rollout.
    $sessionToken = null;
}

// Return first match (typically one client per email), with the opaque token.
$payload = $results[0];
if ($sessionToken) {
    $payload['sessionToken'] = $sessionToken;
    $payload['sessionExpiresAt'] = $expiresAt;
}
ok($payload);
