<?php
// Receives Soroban's "bookable-events-ack" and records the proposed→posted
// state per source_id. Auth: admin session OR Bearer (SOROBAN_TOKEN). POST only.
//
// Status semantics:
//   posted        → booked; store ecriture_id back-ref.
//   duplicate     → already booked (idempotent); treat as posted.
//   ignored_scope → perso, never booked; mark out-of-scope (ecriture_id null).
//   needs_mapping → unknown category; NOT booked — stays in the feed to retry.
//   error         → NOT booked — stays in the feed to retry.
require_once __DIR__ . '/../_bootstrap.php';

function bridgeAuthed(): bool {
    if (validateAdminSession() !== null) return true;
    $hdr = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if ($hdr === '' && function_exists('getallheaders')) {
        foreach (getallheaders() as $k => $v) {
            if (strcasecmp($k, 'Authorization') === 0) { $hdr = $v; break; }
        }
    }
    return defined('SOROBAN_TOKEN') && SOROBAN_TOKEN !== ''
        && preg_match('/^\s*Bearer\s+(\S+)\s*$/i', $hdr, $m)
        && hash_equals(SOROBAN_TOKEN, $m[1]);
}
if (!bridgeAuthed()) fail('Unauthorized', 401);
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail('Method not allowed', 405);

try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS soroban_postings (
        source_id   VARCHAR(191) NOT NULL PRIMARY KEY,
        status      VARCHAR(24)  NOT NULL,
        ecriture_id VARCHAR(64)  NULL,
        posted_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
} catch (Throwable $e) {}

$body    = body();
$results = $body['results'] ?? null;
if (!is_array($results)) fail('results[] required');

$VALID = ['posted', 'duplicate', 'needs_mapping', 'ignored_scope', 'error'];
$up = $pdo->prepare("INSERT INTO soroban_postings (source_id, status, ecriture_id)
                     VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE status = VALUES(status), ecriture_id = VALUES(ecriture_id), posted_at = NOW()");

$applied = 0;
$resolved = 0;
foreach ($results as $r) {
    if (!is_array($r)) continue;
    $sid    = (string)($r['source_id'] ?? $r['sourceId'] ?? '');
    $status = (string)($r['status'] ?? '');
    if ($sid === '' || !in_array($status, $VALID, true)) continue;
    $ecr = (array_key_exists('ecriture_id', $r) && $r['ecriture_id'] !== null) ? (string)$r['ecriture_id'] : null;
    $up->execute([substr($sid, 0, 191), $status, $ecr]);
    $applied++;
    if (in_array($status, ['posted', 'duplicate', 'ignored_scope'], true)) $resolved++;
}

ok(['ok' => true, 'applied' => $applied, 'resolved' => $resolved]);
