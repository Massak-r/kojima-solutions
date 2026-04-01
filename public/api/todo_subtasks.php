<?php
require_once __DIR__ . '/_bootstrap.php';
requireAuth();

function mapSubtask(array $row): array {
    return [
        'id'             => $row['id'],
        'source'         => $row['source'],
        'parentId'       => $row['parent_id'],
        'text'           => $row['text'],
        'completed'      => (bool)$row['completed'],
        'dueDate'        => $row['due_date'] ?? null,
        'order'          => (int)$row['sort_order'],
        'description'    => $row['description'] ?? null,
        'smartSpecific'  => $row['smart_specific'] ?? null,
        'smartMeasurable'=> $row['smart_measurable'] ?? null,
        'smartAchievable'=> $row['smart_achievable'] ?? null,
        'smartRelevant'  => $row['smart_relevant'] ?? null,
        'priority'       => $row['priority'] ?? 'medium',
        'status'         => $row['status'] ?? 'not_started',
        'flaggedToday'   => (bool)($row['flagged_today'] ?? 0),
        'createdAt'      => $row['created_at'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id']        ?? null;
$source = $_GET['source']    ?? null;
$parent = $_GET['parent_id'] ?? null;

// GET
if ($method === 'GET') {
    if ($parent) {
        $stmt = $pdo->prepare('SELECT * FROM todo_subtasks WHERE parent_id = ? ORDER BY sort_order ASC, created_at ASC');
        $stmt->execute([$parent]);
    } elseif ($source) {
        $stmt = $pdo->prepare('SELECT * FROM todo_subtasks WHERE source = ? ORDER BY sort_order ASC, created_at ASC');
        $stmt->execute([$source]);
    } else {
        $stmt = $pdo->query('SELECT * FROM todo_subtasks ORDER BY sort_order ASC, created_at ASC');
    }
    ok(array_map('mapSubtask', $stmt->fetchAll()));
}

// POST
if ($method === 'POST') {
    $data = body();
    $src  = $data['source']   ?? null;
    $pid  = $data['parentId'] ?? null;
    $text = trim($data['text'] ?? '');
    if (!$src || !$pid || !$text) fail('source, parentId, text required');

    $newId    = uuid();
    $maxStmt  = $pdo->prepare('SELECT COALESCE(MAX(sort_order), -1) FROM todo_subtasks WHERE source = ? AND parent_id = ?');
    $maxStmt->execute([$src, $pid]);
    $maxOrder = (int)$maxStmt->fetchColumn();

    $pdo->prepare('INSERT INTO todo_subtasks (id, source, parent_id, text, completed, due_date, sort_order, description, priority, status) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)')
        ->execute([$newId, $src, $pid, $text, $data['dueDate'] ?? null, $maxOrder + 1, $data['description'] ?? null, $data['priority'] ?? 'medium', $data['status'] ?? 'not_started']);

    $stmt = $pdo->prepare('SELECT * FROM todo_subtasks WHERE id = ?');
    $stmt->execute([$newId]);
    ok(mapSubtask($stmt->fetch()));
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
        'dueDate'        => ['due_date = ?',         fn($v) => $v],
        'order'          => ['sort_order = ?',       fn($v) => (int)$v],
        'description'    => ['description = ?',      fn($v) => $v],
        'smartSpecific'  => ['smart_specific = ?',   fn($v) => $v],
        'smartMeasurable'=> ['smart_measurable = ?', fn($v) => $v],
        'smartAchievable'=> ['smart_achievable = ?', fn($v) => $v],
        'smartRelevant'  => ['smart_relevant = ?',   fn($v) => $v],
        'priority'       => ['priority = ?',         fn($v) => $v],
        'status'         => ['status = ?',           fn($v) => $v],
        'flaggedToday'   => ['flagged_today = ?',    fn($v) => (int)(bool)$v],
    ];

    foreach ($map as $key => [$sql, $cast]) {
        if (array_key_exists($key, $data)) {
            $fields[] = $sql;
            $values[] = $cast($data[$key]);
        }
    }

    if (!empty($fields)) {
        $values[] = $id;
        $pdo->prepare('UPDATE todo_subtasks SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($values);
    }

    $stmt = $pdo->prepare('SELECT * FROM todo_subtasks WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) fail('Subtask not found', 404);
    ok(mapSubtask($row));
}

// DELETE
if ($method === 'DELETE') {
    if (!$id) fail('Missing id');
    $pdo->prepare('DELETE FROM todo_subtasks WHERE id = ?')->execute([$id]);
    ok();
}

fail('Method not allowed', 405);
