<?php
// Bank-transactions feed for the Soroban bridge (Kojima -> Soroban "À classer").
// Soroban PULLS pasted/parsed bank lines here (Bearer, outbound) and turns each
// into a capture to classify. Read-model only; centimes on the wire (bridge
// convention). Same auth gate as events.php / acks.php / snapshot.php.
require_once __DIR__ . '/../_bootstrap.php';

function bridgeAuthed(): bool {
    if (validateAdminSession() !== null) return true;
    $hdr = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if ($hdr === '' && function_exists('getallheaders')) {
        foreach (getallheaders() as $k => $v) { if (strcasecmp($k, 'Authorization') === 0) { $hdr = $v; break; } }
    }
    return defined('SOROBAN_TOKEN') && SOROBAN_TOKEN !== ''
        && preg_match('/^\s*Bearer\s+(\S+)\s*$/i', $hdr, $m)
        && hash_equals(SOROBAN_TOKEN, $m[1]);
}
if (!bridgeAuthed()) fail('Unauthorized', 401);
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') fail('Method not allowed', 405);

try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS bank_transactions (
        id VARCHAR(36) PRIMARY KEY, booking_date DATE NOT NULL, value_date DATE NULL,
        amount DECIMAL(12,2) NOT NULL, currency VARCHAR(3) NOT NULL DEFAULT 'CHF',
        description TEXT NULL, counterparty VARCHAR(255) NULL, balance_after DECIMAL(14,2) NULL,
        source_key VARCHAR(191) NOT NULL UNIQUE, pulled_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
} catch (Throwable $e) {}

$since = isset($_GET['since']) ? substr(trim((string)$_GET['since']), 0, 10) : null;
$sql   = "SELECT * FROM bank_transactions";
$args  = [];
if ($since) { $sql .= " WHERE booking_date >= ?"; $args[] = $since; }
$sql  .= " ORDER BY booking_date ASC, created_at ASC";
$stmt  = $pdo->prepare($sql);
$stmt->execute($args);
$rows = $stmt->fetchAll();

$documents = [];
$ids = [];
foreach ($rows as $r) {
    $ids[] = $r['id'];
    $documents[] = [
        'type'                => 'bank_transaction',
        'source_id'           => 'bank:' . $r['source_key'],
        'booking_date'        => $r['booking_date'],
        'value_date'          => $r['value_date'],
        'amount_cents'        => (int) round(((float)$r['amount']) * 100), // signed: negative = débit
        'currency'            => $r['currency'] ?: 'CHF',
        'label'               => $r['description'] ?? '',
        'counterparty'        => $r['counterparty'] ?? '',
        'balance_after_cents' => $r['balance_after'] !== null ? (int) round(((float)$r['balance_after']) * 100) : null,
    ];
}

// A Bearer pull (Soroban) stamps pulled_at so the Kojima UI can show "récupéré";
// an admin-session call (manual test) stays read-only.
if ($ids && validateAdminSession() === null) {
    $ph = implode(',', array_fill(0, count($ids), '?'));
    try { $pdo->prepare("UPDATE bank_transactions SET pulled_at = NOW() WHERE pulled_at IS NULL AND id IN ($ph)")->execute($ids); } catch (Throwable $e) {}
}

ok([
    'protocol'     => 'kojima-soroban-bridge',
    'version'      => '1.0',
    'feed'         => 'bank-transactions',
    'generated_at' => gmdate('Y-m-d\TH:i:s\Z'),
    'source'       => ['system' => 'kojima'],
    'documents'    => $documents,
]);
