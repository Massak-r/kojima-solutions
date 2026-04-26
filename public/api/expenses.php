<?php
require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

function mapExpense(array $row): array {
    return [
        'id'          => $row['id'],
        'date'        => $row['date'],
        'amount'      => (float)$row['amount'],
        'description' => $row['description'],
        'category'    => $row['category'],
        'notes'       => $row['notes'] ?? null,
        'createdAt'   => $row['created_at'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? null;

// GET — list expenses, optional ?year=YYYY filter
if ($method === 'GET') {
    $year = $_GET['year'] ?? null;
    if ($year) {
        $stmt = $pdo->prepare('SELECT * FROM expenses WHERE YEAR(date) = ? ORDER BY date DESC');
        $stmt->execute([(int)$year]);
    } else {
        $stmt = $pdo->query('SELECT * FROM expenses ORDER BY date DESC');
    }
    ok(array_map('mapExpense', $stmt->fetchAll()));
}

// POST — create expense (also supports batch import via ?batch=1)
if ($method === 'POST') {
    $batch = $_GET['batch'] ?? null;

    if ($batch) {
        // Batch import: expects array of expense objects
        $items = body();
        if (!is_array($items)) fail('Expected array');

        $stmt = $pdo->prepare('INSERT INTO expenses (id, date, amount, description, category, notes) VALUES (?, ?, ?, ?, ?, ?)');
        $imported = 0;
        foreach ($items as $data) {
            $expId = $data['id'] ?? uuid();
            $stmt->execute([
                $expId,
                $data['date']        ?? date('Y-m-d'),
                (float)($data['amount'] ?? 0),
                $data['description'] ?? '',
                $data['category']    ?? 'other',
                $data['notes']       ?? null,
            ]);
            $imported++;
        }
        ok(['imported' => $imported]);
    }

    $data  = body();
    $newId = uuid();

    $pdo->prepare('INSERT INTO expenses (id, date, amount, description, category, notes) VALUES (?, ?, ?, ?, ?, ?)')
        ->execute([
            $newId,
            $data['date']        ?? date('Y-m-d'),
            (float)($data['amount']      ?? 0),
            $data['description'] ?? '',
            $data['category']    ?? 'other',
            $data['notes']       ?? null,
        ]);

    $stmt = $pdo->prepare('SELECT * FROM expenses WHERE id = ?');
    $stmt->execute([$newId]);
    ok(mapExpense($stmt->fetch()));
}

// PUT — update fields
if ($method === 'PUT') {
    if (!$id) fail('Missing id');
    $data   = body();
    $fields = [];
    $values = [];

    if (array_key_exists('date',        $data)) { $fields[] = 'date = ?';        $values[] = $data['date']; }
    if (array_key_exists('amount',      $data)) { $fields[] = 'amount = ?';      $values[] = (float)$data['amount']; }
    if (array_key_exists('description', $data)) { $fields[] = 'description = ?'; $values[] = $data['description']; }
    if (array_key_exists('category',    $data)) { $fields[] = 'category = ?';    $values[] = $data['category']; }
    if (array_key_exists('notes',       $data)) { $fields[] = 'notes = ?';       $values[] = $data['notes']; }

    if (!empty($fields)) {
        $values[] = $id;
        $pdo->prepare('UPDATE expenses SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($values);
    }

    $stmt = $pdo->prepare('SELECT * FROM expenses WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) fail('Expense not found', 404);
    ok(mapExpense($row));
}

// DELETE
if ($method === 'DELETE') {
    if (!$id) fail('Missing id');
    $pdo->prepare('DELETE FROM expenses WHERE id = ?')->execute([$id]);
    ok();
}
