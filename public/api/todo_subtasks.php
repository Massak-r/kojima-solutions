<?php
require_once __DIR__ . '/_bootstrap.php';
requireAuth();

// Ensure objective_activity exists (we emit into it)
try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS objective_activity (
            id           VARCHAR(36) PRIMARY KEY,
            source       ENUM('personal','admin') NOT NULL,
            objective_id VARCHAR(36) NOT NULL,
            kind         VARCHAR(40)  NOT NULL,
            payload      JSON         DEFAULT NULL,
            created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_obj_time (source, objective_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
} catch (Throwable $e) {}

// Auto-migrate: parent_subtask_id (for 2-level nesting) + effort_size + estimated_minutes
try {
    $cols = array_column($pdo->query('SHOW COLUMNS FROM todo_subtasks')->fetchAll(), 'Field');
    if (!in_array('parent_subtask_id', $cols)) {
        $pdo->exec('ALTER TABLE todo_subtasks ADD COLUMN parent_subtask_id VARCHAR(36) DEFAULT NULL');
        $pdo->exec('CREATE INDEX idx_parent_sub ON todo_subtasks (parent_subtask_id)');
    }
    if (!in_array('effort_size', $cols)) {
        $pdo->exec("ALTER TABLE todo_subtasks ADD COLUMN effort_size ENUM('rapide','moyen','complexe') DEFAULT NULL");
    }
    if (!in_array('estimated_minutes', $cols)) {
        $pdo->exec('ALTER TABLE todo_subtasks ADD COLUMN estimated_minutes INT DEFAULT NULL');
    }
} catch (Throwable $e) {}

function emitSubtaskActivity(PDO $pdo, string $source, string $objectiveId, string $kind, array $payload): void {
    try {
        $pdo->prepare('INSERT INTO objective_activity (id, source, objective_id, kind, payload) VALUES (?, ?, ?, ?, ?)')
            ->execute([uuid(), $source, $objectiveId, $kind, json_encode($payload)]);
    } catch (Throwable $e) {}
}

function mapSubtask(array $row): array {
    return [
        'id'             => $row['id'],
        'source'         => $row['source'],
        'parentId'       => $row['parent_id'],
        'parentSubtaskId'=> $row['parent_subtask_id'] ?? null,
        'text'           => $row['text'],
        'completed'      => (bool)$row['completed'],
        'dueDate'        => $row['due_date'] ?? null,
        'order'          => (int)$row['sort_order'],
        'description'    => $row['description'] ?? null,
        'smartSpecific'  => $row['smart_specific'] ?? null,
        'smartMeasurable'=> $row['smart_measurable'] ?? null,
        'smartAchievable'=> $row['smart_achievable'] ?? null,
        'smartRelevant'  => $row['smart_relevant'] ?? null,
        'priority'         => $row['priority'] ?? 'medium',
        'status'           => $row['status'] ?? 'not_started',
        'flaggedToday'     => (bool)($row['flagged_today'] ?? 0),
        'effortSize'       => $row['effort_size'] ?? null,
        'estimatedMinutes' => isset($row['estimated_minutes']) ? (int)$row['estimated_minutes'] : null,
        'createdAt'        => $row['created_at'],
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
    $psid = $data['parentSubtaskId'] ?? null;
    $text = trim($data['text'] ?? '');
    if (!$src || !$pid || !$text) fail('source, parentId, text required');

    $newId = uuid();
    // Order scoped to siblings at the same level (same parent_id + same parent_subtask_id)
    if ($psid) {
        $maxStmt = $pdo->prepare('SELECT COALESCE(MAX(sort_order), -1) FROM todo_subtasks WHERE source = ? AND parent_id = ? AND parent_subtask_id = ?');
        $maxStmt->execute([$src, $pid, $psid]);
    } else {
        $maxStmt = $pdo->prepare('SELECT COALESCE(MAX(sort_order), -1) FROM todo_subtasks WHERE source = ? AND parent_id = ? AND parent_subtask_id IS NULL');
        $maxStmt->execute([$src, $pid]);
    }
    $maxOrder = (int)$maxStmt->fetchColumn();

    $pdo->prepare('INSERT INTO todo_subtasks (id, source, parent_id, parent_subtask_id, text, completed, due_date, sort_order, description, priority, status, effort_size, estimated_minutes) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)')
        ->execute([
            $newId, $src, $pid, $psid, $text,
            $data['dueDate'] ?? null,
            $maxOrder + 1,
            $data['description'] ?? null,
            $data['priority'] ?? 'medium',
            $data['status'] ?? 'not_started',
            $data['effortSize'] ?? null,
            isset($data['estimatedMinutes']) ? (int)$data['estimatedMinutes'] : null,
        ]);

    $stmt = $pdo->prepare('SELECT * FROM todo_subtasks WHERE id = ?');
    $stmt->execute([$newId]);
    ok(mapSubtask($stmt->fetch()));
}

// PUT
if ($method === 'PUT') {
    if (!$id) fail('Missing id');

    // Load current state for diffing
    $prevStmt = $pdo->prepare('SELECT * FROM todo_subtasks WHERE id = ?');
    $prevStmt->execute([$id]);
    $prev = $prevStmt->fetch();
    if (!$prev) fail('Subtask not found', 404);

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
        'effortSize'      => ['effort_size = ?',        fn($v) => $v ?: null],
        'parentSubtaskId' => ['parent_subtask_id = ?',  fn($v) => $v ?: null],
        'estimatedMinutes'=> ['estimated_minutes = ?',  fn($v) => $v === null || $v === '' ? null : (int)$v],
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

    // Emit activity for relevant changes
    if (array_key_exists('completed', $data) && (int)(bool)$data['completed'] !== (int)$prev['completed']) {
        emitSubtaskActivity($pdo, $prev['source'], $prev['parent_id'],
            $row['completed'] ? 'subtask_completed' : 'subtask_uncompleted',
            ['subtaskId' => $id, 'text' => $row['text']]);
    }
    if (array_key_exists('flaggedToday', $data) && (int)(bool)$data['flaggedToday'] !== (int)($prev['flagged_today'] ?? 0)) {
        emitSubtaskActivity($pdo, $prev['source'], $prev['parent_id'],
            $row['flagged_today'] ? 'focus_set' : 'focus_cleared',
            ['subtaskId' => $id, 'text' => $row['text']]);
    }
    if (array_key_exists('status', $data) && ($data['status'] ?? null) !== ($prev['status'] ?? null)) {
        emitSubtaskActivity($pdo, $prev['source'], $prev['parent_id'], 'status_changed',
            ['subtaskId' => $id, 'text' => $row['text'], 'from' => $prev['status'], 'to' => $row['status']]);
    }

    ok(mapSubtask($row));
}

// DELETE
if ($method === 'DELETE') {
    if (!$id) fail('Missing id');
    // Cascade: delete children (sub-subtasks) first
    $pdo->prepare('DELETE FROM todo_subtasks WHERE parent_subtask_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM todo_subtasks WHERE id = ?')->execute([$id]);
    ok();
}

fail('Method not allowed', 405);
