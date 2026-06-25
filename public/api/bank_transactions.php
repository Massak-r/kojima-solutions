<?php
// Pasted bank transactions (Kojima side). The cockpit parses an e-banking paste
// (src/lib/bankPaste.ts) and POSTs the rows here; they're stored idempotently
// (UNIQUE source_key) and later pulled by Soroban into its "À classer"
// (see public/api/soroban/bank.php). Admin-session only.
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/_bank_feed.php';
requireAdminSession();

$pdo->exec("CREATE TABLE IF NOT EXISTS bank_transactions (
    id VARCHAR(36) PRIMARY KEY,
    booking_date DATE NOT NULL,
    value_date DATE NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'CHF',
    description TEXT NULL,
    counterparty VARCHAR(255) NULL,
    balance_after DECIMAL(14,2) NULL,
    source_key VARCHAR(191) NOT NULL UNIQUE,
    pulled_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

function mapRow(array $r): array {
    return [
        'id'           => $r['id'],
        'bookingDate'  => $r['booking_date'],
        'valueDate'    => $r['value_date'],
        'amount'       => (float)$r['amount'],
        'currency'     => $r['currency'],
        'description'  => $r['description'],
        'counterparty' => $r['counterparty'],
        'balanceAfter' => $r['balance_after'] !== null ? (float)$r['balance_after'] : null,
        'pulledAt'     => $r['pulled_at'],
        'createdAt'    => $r['created_at'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$id = $_GET['id'] ?? null;

if ($method === 'GET') {
    $rows = $pdo->query("SELECT * FROM bank_transactions ORDER BY booking_date DESC, created_at DESC LIMIT 300")->fetchAll();
    ok(array_map('mapRow', $rows));
} elseif ($method === 'POST') {
    $body = body();
    $txns = $body['transactions'] ?? null;
    if (!is_array($txns)) fail('transactions[] required');
    $ins = $pdo->prepare("INSERT IGNORE INTO bank_transactions
        (id, booking_date, value_date, amount, currency, description, counterparty, balance_after, source_key)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stored = 0;
    foreach ($txns as $t) {
        if (!is_array($t)) continue;
        $bd  = substr((string)($t['bookingDate'] ?? ''), 0, 10);
        $key = (string)($t['sourceKey'] ?? '');
        if ($bd === '' || $key === '' || !isset($t['amount'])) continue;
        $ins->execute([
            uuid(), $bd,
            !empty($t['valueDate']) ? substr((string)$t['valueDate'], 0, 10) : null,
            (float)$t['amount'],
            substr((string)($t['currency'] ?? 'CHF'), 0, 3),
            isset($t['description']) ? (string)$t['description'] : null,
            isset($t['counterparty']) ? substr((string)$t['counterparty'], 0, 255) : null,
            (isset($t['balanceAfter']) && $t['balanceAfter'] !== null) ? (float)$t['balanceAfter'] : null,
            substr($key, 0, 191),
        ]);
        if ($ins->rowCount() > 0) $stored++;
    }
    // Push the new running balance onto the linked "compte entreprise", if any.
    $accountSync = syncBankFeedAccount($pdo);
    ok(['stored' => $stored, 'skipped' => count($txns) - $stored, 'total' => count($txns), 'accountSync' => $accountSync]);
} elseif ($method === 'DELETE') {
    if (!$id) fail('Missing id');
    $pdo->prepare("DELETE FROM bank_transactions WHERE id = ?")->execute([$id]);
    syncBankFeedAccount($pdo); // closing balance may have changed
    ok();
} else {
    fail('Method not allowed', 405);
}
