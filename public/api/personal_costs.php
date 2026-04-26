<?php
require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

function mapCost(array $row): array {
    return [
        'id'        => $row['id'],
        'name'      => $row['name'],
        'amount'    => (float)$row['amount'],
        'frequency' => $row['frequency'],
        'category'  => $row['category'] ?? null,
        'lastPaid'  => $row['last_paid'] ?? null,
        'createdAt' => $row['created_at'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? null;

// GET — list all costs
if ($method === 'GET') {
    $rows = $pdo->query('SELECT * FROM personal_costs ORDER BY created_at ASC')->fetchAll();
    ok(array_map('mapCost', $rows));
}

// POST — create a new cost
if ($method === 'POST') {
    $data  = body();
    $newId = uuid();

    $pdo->prepare('INSERT INTO personal_costs (id, name, amount, frequency, category, last_paid) VALUES (?, ?, ?, ?, ?, ?)')
        ->execute([
            $newId,
            $data['name']      ?? '',
            (float)($data['amount']    ?? 0),
            $data['frequency'] ?? 'monthly',
            $data['category']  ?? null,
            $data['lastPaid']  ?? null,
        ]);

    $stmt = $pdo->prepare('SELECT * FROM personal_costs WHERE id = ?');
    $stmt->execute([$newId]);
    ok(mapCost($stmt->fetch()));
}

// PUT — update fields
if ($method === 'PUT') {
    if (!$id) fail('Missing id');
    $data   = body();
    $fields = [];
    $values = [];

    if (array_key_exists('name',      $data)) { $fields[] = 'name = ?';      $values[] = $data['name']; }
    if (array_key_exists('amount',    $data)) { $fields[] = 'amount = ?';    $values[] = (float)$data['amount']; }
    if (array_key_exists('frequency', $data)) { $fields[] = 'frequency = ?'; $values[] = $data['frequency']; }
    if (array_key_exists('category',  $data)) { $fields[] = 'category = ?';  $values[] = $data['category']; }
    if (array_key_exists('lastPaid',  $data)) { $fields[] = 'last_paid = ?'; $values[] = $data['lastPaid']; }

    if (!empty($fields)) {
        $values[] = $id;
        $pdo->prepare('UPDATE personal_costs SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($values);
    }

    $stmt = $pdo->prepare('SELECT * FROM personal_costs WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) fail('Cost not found', 404);
    ok(mapCost($row));
}

// DELETE
if ($method === 'DELETE') {
    if (!$id) fail('Missing id');
    $pdo->prepare('DELETE FROM personal_costs WHERE id = ?')->execute([$id]);
    ok();
}
