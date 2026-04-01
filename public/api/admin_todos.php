<?php
require_once __DIR__ . '/_bootstrap.php';
requireAuth();

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? null;

function mapTodo(array $row): array {
    return [
        'id'             => $row['id'],
        'text'           => $row['text'],
        'completed'      => (bool)$row['completed'],
        'category'       => $row['category'],
        'dueDate'        => $row['due_date'] ?: null,
        'recurring'      => $row['recurring'] ?? null,
        'isObjective'    => (bool)($row['is_objective'] ?? 0),
        'description'    => $row['description'] ?? null,
        'smartSpecific'  => $row['smart_specific'] ?? null,
        'smartMeasurable'=> $row['smart_measurable'] ?? null,
        'smartAchievable'=> $row['smart_achievable'] ?? null,
        'smartRelevant'  => $row['smart_relevant'] ?? null,
        'priority'       => $row['priority'] ?? 'medium',
        'status'         => $row['status'] ?? 'not_started',
        'order'          => (int)$row['sort_order'],
        'createdAt'      => $row['created_at'],
    ];
}

if ($method === 'GET') {
    $cats = $_GET['categories'] ?? null;
    if ($cats) {
        $catList = explode(',', $cats);
        $placeholders = implode(',', array_fill(0, count($catList), '?'));
        $stmt = $pdo->prepare("SELECT * FROM admin_todos WHERE category IN ($placeholders) ORDER BY sort_order, created_at");
        $stmt->execute($catList);
        $rows = $stmt->fetchAll();
    } else {
        $rows = $pdo->query('SELECT * FROM admin_todos ORDER BY sort_order, created_at')->fetchAll();
    }
    ok(array_map('mapTodo', $rows));
}

if ($method === 'POST') {
    $data  = body();
    $text  = trim($data['text'] ?? '');
    if (!$text) fail('text required');
    $cat   = trim($data['category'] ?? '') ?: 'Général';
    $due   = $data['dueDate'] ?? null;
    $rec   = $data['recurring'] ?? null;
    $newId = uuid();
    $ord   = (int)$pdo->query('SELECT COALESCE(MAX(sort_order),0)+1 FROM admin_todos')->fetchColumn();
    $isObj = (int)(!empty($data['isObjective']));
    $desc  = $data['description'] ?? null;
    $pdo->prepare(
        'INSERT INTO admin_todos (id, text, completed, category, due_date, recurring, sort_order, is_objective, description, smart_specific, smart_measurable, smart_achievable, smart_relevant, priority, status, created_at) VALUES (?,?,0,?,?,?,?,?,?,?,?,?,?,?,?,NOW())'
    )->execute([
        $newId, $text, $cat, $due, $rec, $ord, $isObj, $desc,
        $data['smartSpecific'] ?? null,
        $data['smartMeasurable'] ?? null,
        $data['smartAchievable'] ?? null,
        $data['smartRelevant'] ?? null,
        $data['priority'] ?? 'medium',
        $data['status'] ?? 'not_started',
    ]);
    $row = $pdo->prepare('SELECT * FROM admin_todos WHERE id=?');
    $row->execute([$newId]);
    ok(mapTodo($row->fetch()));
}

if ($method === 'PUT' && $id) {
    $data   = body();
    $fields = [];
    $params = [];

    $map = [
        'text'           => ['text = ?',             fn($v) => $v],
        'completed'      => ['completed = ?',        fn($v) => (int)(bool)$v],
        'category'       => ['category = ?',         fn($v) => $v],
        'dueDate'        => ['due_date = ?',         fn($v) => $v ?: null],
        'recurring'      => ['recurring = ?',        fn($v) => $v ?: null],
        'order'          => ['sort_order = ?',        fn($v) => (int)$v],
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
            $params[] = $cast($data[$key]);
        }
    }

    if (empty($fields)) fail('Nothing to update');
    $params[] = $id;
    $pdo->prepare('UPDATE admin_todos SET ' . implode(', ', $fields) . ' WHERE id=?')->execute($params);
    $row = $pdo->prepare('SELECT * FROM admin_todos WHERE id=?');
    $row->execute([$id]);
    ok(mapTodo($row->fetch()));
}

if ($method === 'DELETE' && $id) {
    $pdo->prepare("DELETE FROM todo_subtasks WHERE parent_id = ?")->execute([$id]);
    $pdo->prepare('DELETE FROM admin_todos WHERE id=?')->execute([$id]);
    ok();
}

fail('Method not allowed', 405);
