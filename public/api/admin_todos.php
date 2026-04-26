<?php
require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

// Auto-migrate: objective workspace columns + updated_at
try {
    $cols = array_column($pdo->query('SHOW COLUMNS FROM admin_todos')->fetchAll(), 'Field');
    if (!in_array('definition_of_done', $cols)) {
        $pdo->exec('ALTER TABLE admin_todos ADD COLUMN definition_of_done TEXT DEFAULT NULL');
    }
    if (!in_array('linked_project_id', $cols)) {
        $pdo->exec('ALTER TABLE admin_todos ADD COLUMN linked_project_id VARCHAR(36) DEFAULT NULL');
    }
    if (!in_array('linked_client_id', $cols)) {
        $pdo->exec('ALTER TABLE admin_todos ADD COLUMN linked_client_id VARCHAR(36) DEFAULT NULL');
    }
    if (!in_array('updated_at', $cols)) {
        // updated_at powers "untouched in N days" cues on /space. Backfill with
        // created_at so existing rows get a sensible baseline.
        $pdo->exec('ALTER TABLE admin_todos ADD COLUMN updated_at DATETIME DEFAULT NULL');
        $pdo->exec('UPDATE admin_todos SET updated_at = created_at WHERE updated_at IS NULL');
    }
} catch (Throwable $e) {}

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? null;

function mapTodo(array $row): array {
    return [
        'id'               => $row['id'],
        'text'             => $row['text'],
        'completed'        => (bool)$row['completed'],
        'category'         => $row['category'],
        'dueDate'          => $row['due_date'] ?: null,
        'recurring'        => $row['recurring'] ?? null,
        'isObjective'      => (bool)($row['is_objective'] ?? 0),
        'description'      => $row['description'] ?? null,
        'smartSpecific'    => $row['smart_specific'] ?? null,
        'smartMeasurable'  => $row['smart_measurable'] ?? null,
        'smartAchievable'  => $row['smart_achievable'] ?? null,
        'smartRelevant'    => $row['smart_relevant'] ?? null,
        'priority'         => $row['priority'] ?? 'medium',
        'status'           => $row['status'] ?? 'not_started',
        'order'            => (int)$row['sort_order'],
        'definitionOfDone' => $row['definition_of_done'] ?? null,
        'linkedProjectId'  => $row['linked_project_id'] ?? null,
        'linkedClientId'   => $row['linked_client_id'] ?? null,
        'createdAt'        => $row['created_at'],
        'updatedAt'        => $row['updated_at'] ?? $row['created_at'],
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
        'INSERT INTO admin_todos (id, text, completed, category, due_date, recurring, sort_order, is_objective, description, smart_specific, smart_measurable, smart_achievable, smart_relevant, priority, status, created_at, updated_at) VALUES (?,?,0,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())'
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
        'text'            => ['text = ?',                fn($v) => $v],
        'completed'       => ['completed = ?',           fn($v) => (int)(bool)$v],
        'category'        => ['category = ?',            fn($v) => $v],
        'dueDate'         => ['due_date = ?',            fn($v) => $v ?: null],
        'recurring'       => ['recurring = ?',           fn($v) => $v ?: null],
        'order'           => ['sort_order = ?',          fn($v) => (int)$v],
        'isObjective'     => ['is_objective = ?',        fn($v) => (int)(bool)$v],
        'description'     => ['description = ?',         fn($v) => $v],
        'smartSpecific'   => ['smart_specific = ?',      fn($v) => $v],
        'smartMeasurable' => ['smart_measurable = ?',    fn($v) => $v],
        'smartAchievable' => ['smart_achievable = ?',    fn($v) => $v],
        'smartRelevant'   => ['smart_relevant = ?',      fn($v) => $v],
        'priority'        => ['priority = ?',            fn($v) => $v],
        'status'          => ['status = ?',              fn($v) => $v],
        'definitionOfDone'=> ['definition_of_done = ?',  fn($v) => $v ?: null],
        'linkedProjectId' => ['linked_project_id = ?',   fn($v) => $v ?: null],
        'linkedClientId'  => ['linked_client_id = ?',    fn($v) => $v ?: null],
    ];

    foreach ($map as $key => [$sql, $cast]) {
        if (array_key_exists($key, $data)) {
            $fields[] = $sql;
            $params[] = $cast($data[$key]);
        }
    }

    if (empty($fields)) fail('Nothing to update');
    $fields[] = 'updated_at = NOW()';
    $params[] = $id;
    $pdo->prepare('UPDATE admin_todos SET ' . implode(', ', $fields) . ' WHERE id=?')->execute($params);
    $row = $pdo->prepare('SELECT * FROM admin_todos WHERE id=?');
    $row->execute([$id]);
    ok(mapTodo($row->fetch()));
}

if ($method === 'DELETE' && $id) {
    $pdo->prepare("DELETE FROM todo_subtasks WHERE parent_id = ?")->execute([$id]);
    foreach (['objective_notes','objective_files','objective_links','objective_sessions','objective_activity','objective_decisions'] as $t) {
        try { $pdo->prepare("DELETE FROM $t WHERE source = 'admin' AND objective_id = ?")->execute([$id]); } catch (Throwable $e) {}
    }
    $pdo->prepare('DELETE FROM admin_todos WHERE id=?')->execute([$id]);
    ok();
}

fail('Method not allowed', 405);
