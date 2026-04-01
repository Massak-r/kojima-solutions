<?php
require_once __DIR__ . '/_bootstrap.php';
requireAuth();

function mapTodo(array $row): array {
    return [
        'id'        => $row['id'],
        'text'      => $row['text'],
        'completed' => (bool)$row['completed'],
        'order'     => (int)$row['sort_order'],
        'createdAt' => $row['created_at'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? null;

// GET — list all todos ordered by sort_order
if ($method === 'GET') {
    $rows = $pdo->query('SELECT * FROM todos ORDER BY sort_order ASC, created_at ASC')->fetchAll();
    ok(array_map('mapTodo', $rows));
}

// POST — create a new todo
if ($method === 'POST') {
    $data     = body();
    $newId    = uuid();
    $maxOrder = (int)$pdo->query('SELECT COALESCE(MAX(sort_order), -1) FROM todos')->fetchColumn();

    $pdo->prepare('INSERT INTO todos (id, text, completed, sort_order) VALUES (?, ?, 0, ?)')
        ->execute([$newId, $data['text'] ?? '', $maxOrder + 1]);

    $stmt = $pdo->prepare('SELECT * FROM todos WHERE id = ?');
    $stmt->execute([$newId]);
    ok(mapTodo($stmt->fetch()));
}

// PUT — update text / completed / order
if ($method === 'PUT') {
    if (!$id) fail('Missing id');
    $data   = body();
    $fields = [];
    $values = [];

    if (array_key_exists('completed', $data)) { $fields[] = 'completed = ?';  $values[] = (int)(bool)$data['completed']; }
    if (array_key_exists('text', $data))      { $fields[] = 'text = ?';       $values[] = $data['text']; }
    if (array_key_exists('order', $data))     { $fields[] = 'sort_order = ?'; $values[] = (int)$data['order']; }

    if (!empty($fields)) {
        $values[] = $id;
        $pdo->prepare('UPDATE todos SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($values);
    }

    $stmt = $pdo->prepare('SELECT * FROM todos WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) fail('Todo not found', 404);
    ok(mapTodo($row));
}

// DELETE
if ($method === 'DELETE') {
    if (!$id) fail('Missing id');
    $pdo->prepare('DELETE FROM todos WHERE id = ?')->execute([$id]);
    ok();
}
