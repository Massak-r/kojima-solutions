<?php
// Receiver for Soroban's accounting-snapshot (Soroban -> Kojima, Bearer outbound).
// Soroban POSTs the snapshot envelope; we store the latest document of each
// `type` so the Centre admin cockpit can read the `admin_compliance` signal
// (and future consumers can read treasury_position / pnl / etc.). This is a
// read-model only -- nothing here ever writes to the legal ledger.
//
//   POST {protocol,version,feed:"accounting-snapshot",documents:[{type,...}]}
//        -> upsert each document by its `type` (latest wins).
//   GET  ?type=admin_compliance  -> the stored document (or null).
//   GET  (no type)               -> { <type>: <document>, ... } map.
//
// Auth: a valid admin session (cockpit read) OR a Bearer token matching
// SOROBAN_TOKEN (Soroban's server-to-server push) -- same gate as
// events.php / acks.php. Financial data: never open.
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

try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS soroban_snapshot (
        doc_type    VARCHAR(64) NOT NULL PRIMARY KEY,
        as_of       VARCHAR(10) NULL,
        payload     LONGTEXT    NOT NULL,
        received_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
} catch (Throwable $e) {}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $type = isset($_GET['type']) ? substr(trim((string)$_GET['type']), 0, 64) : null;
    if ($type !== null && $type !== '') {
        $s = $pdo->prepare("SELECT payload FROM soroban_snapshot WHERE doc_type = ?");
        $s->execute([$type]);
        $row = $s->fetch();
        ok($row ? json_decode($row['payload'], true) : null);
    } else {
        $out = [];
        foreach ($pdo->query("SELECT doc_type, payload FROM soroban_snapshot")->fetchAll() as $r) {
            $out[$r['doc_type']] = json_decode($r['payload'], true);
        }
        ok($out);
    }
} elseif ($method === 'POST') {
    $body = body();
    $docs = $body['documents'] ?? null;
    if (!is_array($docs)) fail('documents[] required');

    $envAsOf = isset($body['generated_at']) ? substr((string)$body['generated_at'], 0, 10) : null;
    $up = $pdo->prepare("INSERT INTO soroban_snapshot (doc_type, as_of, payload)
                         VALUES (?, ?, ?)
                         ON DUPLICATE KEY UPDATE as_of = VALUES(as_of), payload = VALUES(payload), received_at = NOW()");

    $stored = [];
    foreach ($docs as $doc) {
        if (!is_array($doc)) continue;
        $type = (string)($doc['type'] ?? '');
        if ($type === '') continue;
        $asOf = isset($doc['as_of']) ? substr((string)$doc['as_of'], 0, 10) : $envAsOf;
        $up->execute([substr($type, 0, 64), $asOf, json_encode($doc, JSON_UNESCAPED_UNICODE)]);
        $stored[] = $type;
    }

    ok(['ok' => true, 'stored' => count($stored), 'types' => array_values(array_unique($stored))]);
} else {
    fail('Method not allowed', 405);
}
