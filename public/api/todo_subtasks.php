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

// Auto-migrate: parent_subtask_id (for 2-level nesting) + effort_size + estimated_minutes + flagged_at
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
    if (!in_array('flagged_at', $cols)) {
        // flagged_at = when flagged_today flipped 0→1. NULL when not currently flagged.
        // Enables true stale detection on /sprint (vs. proxying via created_at).
        $pdo->exec('ALTER TABLE todo_subtasks ADD COLUMN flagged_at DATETIME DEFAULT NULL');
        // Backfill: for any currently-flagged rows, stamp with created_at so stale calc has a baseline.
        $pdo->exec('UPDATE todo_subtasks SET flagged_at = created_at WHERE flagged_today = 1 AND flagged_at IS NULL');
    }
    if (!in_array('recurrence', $cols)) {
        // recurrence: null | daily | weekdays | weekly | monthly — drives auto-reflagging
        $pdo->exec('ALTER TABLE todo_subtasks ADD COLUMN recurrence VARCHAR(20) DEFAULT NULL');
    }
    if (!in_array('recurrence_day', $cols)) {
        // recurrence_day: 1-7 for weekly (ISO Mon=1..Sun=7), 1-31 for monthly
        $pdo->exec('ALTER TABLE todo_subtasks ADD COLUMN recurrence_day INT DEFAULT NULL');
    }
    if (!in_array('scheduled_for', $cols)) {
        // scheduled_for: date at which a postponed task should re-flag
        $pdo->exec('ALTER TABLE todo_subtasks ADD COLUMN scheduled_for DATE DEFAULT NULL');
    }
    if (!in_array('completed_at', $cols)) {
        // completed_at: needed to decide if a recurring task should reset today
        $pdo->exec('ALTER TABLE todo_subtasks ADD COLUMN completed_at DATETIME DEFAULT NULL');
    }
} catch (Throwable $e) {}

/**
 * Daily refresh (idempotent):
 *   1) Re-flag postponed tasks whose scheduled_for has arrived
 *   2) Reset recurring tasks completed on a previous day so they re-enter today's sprint
 * Runs on every GET. SQL guards against same-day re-firing via completed_at.
 */
function runDailyRefresh(PDO $pdo): void {
    $today = date('Y-m-d');
    $dow   = (int)date('N'); // 1=Mon..7=Sun
    $dom   = (int)date('j'); // 1..31

    try {
        // 1. Postponed tasks: scheduled_for arrived → re-flag
        $pdo->prepare("UPDATE todo_subtasks
            SET flagged_today = 1, flagged_at = NOW(), scheduled_for = NULL
            WHERE scheduled_for IS NOT NULL AND scheduled_for <= ?")
            ->execute([$today]);

        // 2. Recurring resets — only if completed on an earlier day
        // Daily: every day
        $pdo->prepare("UPDATE todo_subtasks
            SET completed = 0, completed_at = NULL, flagged_today = 1, flagged_at = NOW()
            WHERE recurrence = 'daily' AND completed = 1
              AND (completed_at IS NULL OR DATE(completed_at) < ?)")
            ->execute([$today]);

        // Weekdays: Mon-Fri
        if ($dow >= 1 && $dow <= 5) {
            $pdo->prepare("UPDATE todo_subtasks
                SET completed = 0, completed_at = NULL, flagged_today = 1, flagged_at = NOW()
                WHERE recurrence = 'weekdays' AND completed = 1
                  AND (completed_at IS NULL OR DATE(completed_at) < ?)")
                ->execute([$today]);
        }

        // Weekly: today's day of week matches recurrence_day
        $pdo->prepare("UPDATE todo_subtasks
            SET completed = 0, completed_at = NULL, flagged_today = 1, flagged_at = NOW()
            WHERE recurrence = 'weekly' AND recurrence_day = ? AND completed = 1
              AND (completed_at IS NULL OR DATE(completed_at) < ?)")
            ->execute([$dow, $today]);

        // Monthly: today's day of month matches recurrence_day
        $pdo->prepare("UPDATE todo_subtasks
            SET completed = 0, completed_at = NULL, flagged_today = 1, flagged_at = NOW()
            WHERE recurrence = 'monthly' AND recurrence_day = ? AND completed = 1
              AND (completed_at IS NULL OR DATE(completed_at) < ?)")
            ->execute([$dom, $today]);
    } catch (Throwable $e) {}
}

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
        'flaggedAt'        => $row['flagged_at'] ?? null,
        'effortSize'       => $row['effort_size'] ?? null,
        'estimatedMinutes' => isset($row['estimated_minutes']) ? (int)$row['estimated_minutes'] : null,
        'recurrence'       => $row['recurrence'] ?? null,
        'recurrenceDay'    => isset($row['recurrence_day']) ? (int)$row['recurrence_day'] : null,
        'scheduledFor'     => $row['scheduled_for'] ?? null,
        'completedAt'      => $row['completed_at'] ?? null,
        'createdAt'        => $row['created_at'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id']        ?? null;
$source = $_GET['source']    ?? null;
$parent = $_GET['parent_id'] ?? null;

// GET
if ($method === 'GET') {
    runDailyRefresh($pdo);
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

    $flaggedToday = !empty($data['flaggedToday']) ? 1 : 0;
    $pdo->prepare('INSERT INTO todo_subtasks (id, source, parent_id, parent_subtask_id, text, completed, due_date, sort_order, description, priority, status, effort_size, estimated_minutes, flagged_today, flagged_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ' . ($flaggedToday ? 'NOW()' : 'NULL') . ')')
        ->execute([
            $newId, $src, $pid, $psid, $text,
            $data['dueDate'] ?? null,
            $maxOrder + 1,
            $data['description'] ?? null,
            $data['priority'] ?? 'medium',
            $data['status'] ?? 'not_started',
            $data['effortSize'] ?? null,
            isset($data['estimatedMinutes']) ? (int)$data['estimatedMinutes'] : null,
            $flaggedToday,
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
        'recurrence'      => ['recurrence = ?',         fn($v) => $v ?: null],
        'recurrenceDay'   => ['recurrence_day = ?',     fn($v) => $v === null || $v === '' ? null : (int)$v],
        'scheduledFor'    => ['scheduled_for = ?',      fn($v) => $v ?: null],
    ];

    foreach ($map as $key => [$sql, $cast]) {
        if (array_key_exists($key, $data)) {
            $fields[] = $sql;
            $values[] = $cast($data[$key]);
        }
    }

    // When flaggedToday flips, keep flagged_at in sync:
    // - 0→1: stamp NOW() so stale calc can measure how long the flag has been alive
    // - 1→0: clear, so a future re-flag starts the clock fresh
    if (array_key_exists('flaggedToday', $data)) {
        $nextFlagged = (int)(bool)$data['flaggedToday'];
        $prevFlagged = (int)($prev['flagged_today'] ?? 0);
        if ($nextFlagged !== $prevFlagged) {
            if ($nextFlagged === 1) {
                $fields[] = 'flagged_at = NOW()';
            } else {
                $fields[] = 'flagged_at = NULL';
            }
        }
    }

    // Stamp completed_at on 0→1 transitions so recurrence reset knows the last completion date
    if (array_key_exists('completed', $data)) {
        $nextCompleted = (int)(bool)$data['completed'];
        $prevCompleted = (int)($prev['completed'] ?? 0);
        if ($nextCompleted !== $prevCompleted) {
            $fields[] = $nextCompleted === 1 ? 'completed_at = NOW()' : 'completed_at = NULL';
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
