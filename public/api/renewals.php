<?php
// Renewals / expiry radar — recurring obligations to renew (domaines, hébergement,
// SSL, assurances, contrats, abonnements). CRUD; admin only.
require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

// Self-healing: create the table on first use so the feature works without a
// manual migration run (matches the projects.php auto-migrate convention).
try {
    $pdo->exec("
      CREATE TABLE IF NOT EXISTS renewals (
        id          VARCHAR(36)   NOT NULL,
        label       VARCHAR(255)  NOT NULL,
        category    VARCHAR(64)   NULL,
        expiry_date DATE          NOT NULL,
        recurrence  ENUM('none','monthly','quarterly','biannual','yearly') NOT NULL DEFAULT 'yearly',
        amount      DECIMAL(14,2) NULL,
        notes       TEXT          NULL,
        created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_renewals_expiry (expiry_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
} catch (Throwable $e) {
    error_log('renewals table ensure failed: ' . $e->getMessage());
}

const RENEWAL_RECURRENCE_VALUES = ['none','monthly','quarterly','biannual','yearly'];

function mapRenewal(array $r): array {
    return [
        'id'         => $r['id'],
        'label'      => $r['label'],
        'category'   => $r['category'] ?? null,
        'expiryDate' => $r['expiry_date'],
        'recurrence' => $r['recurrence'] ?? 'yearly',
        'amount'     => isset($r['amount']) && $r['amount'] !== null ? (float)$r['amount'] : null,
        'notes'      => $r['notes'] ?? null,
        'createdAt'  => $r['created_at'],
        'updatedAt'  => $r['updated_at'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? null;

if ($method === 'GET') {
    $stmt = $pdo->query('SELECT * FROM renewals ORDER BY expiry_date ASC');
    ok(array_map('mapRenewal', $stmt->fetchAll()));
}

if ($method === 'POST') {
    $data  = body();
    $newId = uuid();
    $rec   = $data['recurrence'] ?? 'yearly';
    if (!in_array($rec, RENEWAL_RECURRENCE_VALUES, true)) $rec = 'yearly';
    $pdo->prepare(
        'INSERT INTO renewals (id, label, category, expiry_date, recurrence, amount, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $newId,
        trim($data['label'] ?? 'Sans titre'),
        $data['category']   ?? null,
        $data['expiryDate'] ?? date('Y-m-d'),
        $rec,
        (isset($data['amount']) && $data['amount'] !== null && $data['amount'] !== '') ? (float)$data['amount'] : null,
        $data['notes']      ?? null,
    ]);
    $stmt = $pdo->prepare('SELECT * FROM renewals WHERE id = ?');
    $stmt->execute([$newId]);
    ok(mapRenewal($stmt->fetch()));
}

if ($method === 'PUT') {
    if (!$id) fail('Missing id');
    $data   = body();
    $fields = [];
    $vals   = [];
    if (array_key_exists('label',      $data)) { $fields[] = 'label = ?';       $vals[] = trim($data['label']); }
    if (array_key_exists('category',   $data)) { $fields[] = 'category = ?';    $vals[] = $data['category']; }
    if (array_key_exists('expiryDate', $data)) { $fields[] = 'expiry_date = ?'; $vals[] = $data['expiryDate']; }
    if (array_key_exists('recurrence', $data)) {
        $r = in_array($data['recurrence'], RENEWAL_RECURRENCE_VALUES, true) ? $data['recurrence'] : 'yearly';
        $fields[] = 'recurrence = ?'; $vals[] = $r;
    }
    if (array_key_exists('amount',     $data)) { $fields[] = 'amount = ?'; $vals[] = ($data['amount'] !== null && $data['amount'] !== '') ? (float)$data['amount'] : null; }
    if (array_key_exists('notes',      $data)) { $fields[] = 'notes = ?';  $vals[] = $data['notes']; }
    if (!empty($fields)) {
        $vals[] = $id;
        $pdo->prepare('UPDATE renewals SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($vals);
    }
    $stmt = $pdo->prepare('SELECT * FROM renewals WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) fail('Renewal not found', 404);
    ok(mapRenewal($row));
}

if ($method === 'DELETE') {
    if (!$id) fail('Missing id');
    $pdo->prepare('DELETE FROM renewals WHERE id = ?')->execute([$id]);
    ok();
}
