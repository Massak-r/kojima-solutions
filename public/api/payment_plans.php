<?php
require_once __DIR__ . '/_bootstrap.php';
requireAuth();

// Auto-create table
$pdo->exec("CREATE TABLE IF NOT EXISTS payment_plans (
  id             VARCHAR(36)   NOT NULL,
  name           VARCHAR(255)  NOT NULL,
  type           VARCHAR(30)   NOT NULL DEFAULT 'installment',
  monthly_amount DECIMAL(10,2) NOT NULL,
  total_months   INT           NOT NULL DEFAULT 12,
  start_date     DATE          NOT NULL,
  total_owed     DECIMAL(10,2) NULL,
  adjustment     DECIMAL(10,2) NULL,
  category       VARCHAR(50)   NULL,
  notes          TEXT          NULL,
  paid_months    JSON          NOT NULL DEFAULT '[]',
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

function mapPlan(array $row): array {
    return [
        'id'            => $row['id'],
        'name'          => $row['name'],
        'type'          => $row['type'],
        'monthlyAmount' => (float)$row['monthly_amount'],
        'totalMonths'   => (int)$row['total_months'],
        'startDate'     => $row['start_date'],
        'totalOwed'     => $row['total_owed'] !== null ? (float)$row['total_owed'] : null,
        'adjustment'    => $row['adjustment'] !== null ? (float)$row['adjustment'] : null,
        'category'      => $row['category'],
        'notes'         => $row['notes'],
        'paidMonths'    => json_decode($row['paid_months'] ?? '[]', true) ?? [],
        'createdAt'     => $row['created_at'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? null;

// GET — list all plans
if ($method === 'GET') {
    $rows = $pdo->query('SELECT * FROM payment_plans ORDER BY start_date DESC')->fetchAll();
    ok(array_map('mapPlan', $rows));
}

// POST — create
if ($method === 'POST') {
    $data  = body();
    $newId = uuid();

    $pdo->prepare('INSERT INTO payment_plans (id, name, type, monthly_amount, total_months, start_date, total_owed, adjustment, category, notes, paid_months) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        ->execute([
            $newId,
            $data['name']          ?? '',
            $data['type']          ?? 'installment',
            (float)($data['monthlyAmount'] ?? 0),
            (int)($data['totalMonths']     ?? 12),
            $data['startDate']     ?? date('Y-m-d'),
            isset($data['totalOwed'])  ? (float)$data['totalOwed']  : null,
            isset($data['adjustment']) ? (float)$data['adjustment'] : null,
            $data['category']      ?? null,
            $data['notes']         ?? null,
            json_encode($data['paidMonths'] ?? []),
        ]);

    $stmt = $pdo->prepare('SELECT * FROM payment_plans WHERE id = ?');
    $stmt->execute([$newId]);
    ok(mapPlan($stmt->fetch()));
}

// PUT — update fields
if ($method === 'PUT') {
    if (!$id) fail('Missing id');
    $data   = body();
    $fields = [];
    $values = [];

    if (array_key_exists('name',          $data)) { $fields[] = 'name = ?';           $values[] = $data['name']; }
    if (array_key_exists('type',          $data)) { $fields[] = 'type = ?';           $values[] = $data['type']; }
    if (array_key_exists('monthlyAmount', $data)) { $fields[] = 'monthly_amount = ?'; $values[] = (float)$data['monthlyAmount']; }
    if (array_key_exists('totalMonths',   $data)) { $fields[] = 'total_months = ?';   $values[] = (int)$data['totalMonths']; }
    if (array_key_exists('startDate',     $data)) { $fields[] = 'start_date = ?';     $values[] = $data['startDate']; }
    if (array_key_exists('totalOwed',     $data)) { $fields[] = 'total_owed = ?';     $values[] = $data['totalOwed'] !== null ? (float)$data['totalOwed'] : null; }
    if (array_key_exists('adjustment',    $data)) { $fields[] = 'adjustment = ?';     $values[] = $data['adjustment'] !== null ? (float)$data['adjustment'] : null; }
    if (array_key_exists('category',      $data)) { $fields[] = 'category = ?';       $values[] = $data['category']; }
    if (array_key_exists('notes',         $data)) { $fields[] = 'notes = ?';          $values[] = $data['notes']; }
    if (array_key_exists('paidMonths',    $data)) { $fields[] = 'paid_months = ?';    $values[] = json_encode($data['paidMonths']); }

    if (!empty($fields)) {
        $values[] = $id;
        $pdo->prepare('UPDATE payment_plans SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($values);
    }

    $stmt = $pdo->prepare('SELECT * FROM payment_plans WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) fail('Plan not found', 404);
    ok(mapPlan($row));
}

// DELETE
if ($method === 'DELETE') {
    if (!$id) fail('Missing id');
    $pdo->prepare('DELETE FROM payment_plans WHERE id = ?')->execute([$id]);
    ok();
}
