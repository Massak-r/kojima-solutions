<?php
require_once __DIR__ . '/_bootstrap.php';
requireAuth();

function mapTodo(array $row): array {
    return [
        'id'             => $row['id'],
        'text'           => $row['text'],
        'completed'      => (bool)$row['completed'],
        'order'          => (int)$row['sort_order'],
        'dueDate'        => $row['due_date']  ?? null,
        'recurring'      => $row['recurring'] ?? null,
        'isObjective'    => (bool)($row['is_objective'] ?? 0),
        'description'    => $row['description'] ?? null,
        'smartSpecific'  => $row['smart_specific'] ?? null,
        'smartMeasurable'=> $row['smart_measurable'] ?? null,
        'smartAchievable'=> $row['smart_achievable'] ?? null,
        'smartRelevant'  => $row['smart_relevant'] ?? null,
        'priority'       => $row['priority'] ?? 'medium',
        'status'         => $row['status'] ?? 'not_started',
        'createdAt'      => $row['created_at'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? null;

// GET
if ($method === 'GET') {
    $rows = $pdo->query('SELECT * FROM personal_todos ORDER BY sort_order ASC, created_at ASC')->fetchAll();
    ok(array_map('mapTodo', $rows));
}

// POST
if ($method === 'POST') {
    $data     = body();
    $newId    = uuid();
    $maxOrder = (int)$pdo->query('SELECT COALESCE(MAX(sort_order), -1) FROM personal_todos')->fetchColumn();

    $pdo->prepare('INSERT INTO personal_todos (id, text, completed, sort_order, due_date, recurring, is_objective, description, smart_specific, smart_measurable, smart_achievable, smart_relevant, priority, status) VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        ->execute([
            $newId,
            $data['text'] ?? '',
            $maxOrder + 1,
            $data['dueDate'] ?? null,
            $data['recurring'] ?? null,
            (int)(!empty($data['isObjective'])),
            $data['description'] ?? null,
            $data['smartSpecific'] ?? null,
            $data['smartMeasurable'] ?? null,
            $data['smartAchievable'] ?? null,
            $data['smartRelevant'] ?? null,
            $data['priority'] ?? 'medium',
            $data['status'] ?? 'not_started',
        ]);

    $stmt = $pdo->prepare('SELECT * FROM personal_todos WHERE id = ?');
    $stmt->execute([$newId]);
    ok(mapTodo($stmt->fetch()));
}

// PUT
if ($method === 'PUT') {
    if (!$id) fail('Missing id');
    $data   = body();
    $fields = [];
    $values = [];

    $map = [
        'completed'      => ['completed = ?',       fn($v) => (int)(bool)$v],
        'text'           => ['text = ?',             fn($v) => $v],
        'order'          => ['sort_order = ?',       fn($v) => (int)$v],
        'dueDate'        => ['due_date = ?',         fn($v) => $v],
        'recurring'      => ['recurring = ?',        fn($v) => $v],
        'isObjective'    => ['is_objective = ?',     fn($v) => (int)(bool)$v],
        'description'    => ['description = ?',      fn($v) => $v],
        'smartSpecific'  => ['smart_specific = ?',   fn($v) => $v],
        'smartMeasurable'=> ['smart_measurable = ?', fn($v) => $v],
        'smartAchievable'=> ['smart_achievable = ?', fn($v) => $v],
        'smartRelevant'  => ['smart_relevant = ?',   fn($v) => $v],
        'priority'       => ['priority = ?',         fn($v) => $v],
        'status'         => ['status = ?',           fn($v) => $v],
    ];

    foreach ($map as $key => [$sql, $cast]) {
        if (array_key_exists($key, $data)) {
            $fields[] = $sql;
            $values[] = $cast($data[$key]);
        }
    }

    if (!empty($fields)) {
        $values[] = $id;
        $pdo->prepare('UPDATE personal_todos SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($values);
    }

    $stmt = $pdo->prepare('SELECT * FROM personal_todos WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) fail('Todo not found', 404);
    ok(mapTodo($row));
}

// DELETE
if ($method === 'DELETE') {
    if (!$id) fail('Missing id');
    $pdo->prepare("DELETE FROM todo_subtasks WHERE source = 'personal' AND parent_id = ?")->execute([$id]);
    $pdo->prepare('DELETE FROM personal_todos WHERE id = ?')->execute([$id]);
    ok();
}
