<?php
require_once __DIR__ . '/_bootstrap.php';
requireAuthForWrites();

// ── Auto-migrate: unified timeline columns ──
try {
    $cols = array_column($pdo->query('SHOW COLUMNS FROM tasks')->fetchAll(), 'Field');
    if (!in_array('status', $cols)) {
        $pdo->exec("ALTER TABLE tasks ADD COLUMN status ENUM('locked','open','completed') NOT NULL DEFAULT 'open' AFTER color");
    }
    if (!in_array('phase_id', $cols)) {
        $pdo->exec("ALTER TABLE tasks ADD COLUMN phase_id VARCHAR(36) DEFAULT NULL AFTER status");
    }
    if (!in_array('completed_at', $cols)) {
        $pdo->exec("ALTER TABLE tasks ADD COLUMN completed_at DATETIME DEFAULT NULL AFTER phase_id");
    }
    if (!in_array('completed_by', $cols)) {
        $pdo->exec("ALTER TABLE tasks ADD COLUMN completed_by VARCHAR(100) DEFAULT NULL AFTER completed_at");
    }
    if (!in_array('deadline', $cols)) {
        $pdo->exec("ALTER TABLE tasks ADD COLUMN deadline DATE DEFAULT NULL AFTER completed_by");
    }
    if (!in_array('estimated_hours', $cols)) {
        $pdo->exec("ALTER TABLE tasks ADD COLUMN estimated_hours DECIMAL(6,1) DEFAULT NULL AFTER deadline");
    }
    if (!in_array('actual_hours', $cols)) {
        $pdo->exec("ALTER TABLE tasks ADD COLUMN actual_hours DECIMAL(6,1) DEFAULT NULL AFTER estimated_hours");
    }
} catch (Throwable $e) {}

try {
    $cols = array_column($pdo->query('SHOW COLUMNS FROM projects')->fetchAll(), 'Field');
    if (!in_array('share_token', $cols)) {
        $pdo->exec('ALTER TABLE projects ADD COLUMN share_token VARCHAR(64) DEFAULT NULL AFTER deliveries');
        // Backfill from funnels if they exist
        try {
            $pdo->exec('UPDATE projects p JOIN project_funnels pf ON p.id = pf.project_id SET p.share_token = pf.share_token WHERE pf.share_token IS NOT NULL');
        } catch (Throwable $e2) {}
    }
} catch (Throwable $e) {}

try {
    $pdo->exec('
        CREATE TABLE IF NOT EXISTS step_comments (
            id VARCHAR(36) NOT NULL,
            task_id VARCHAR(36) NOT NULL,
            author_name VARCHAR(100) DEFAULT NULL,
            author_email VARCHAR(100) DEFAULT NULL,
            author_role ENUM(\'client\',\'admin\',\'stakeholder\') DEFAULT \'client\',
            message TEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_step_comments_task (task_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ');
} catch (Throwable $e) {}

try {
    $cols = array_column($pdo->query('SHOW COLUMNS FROM feedback_requests')->fetchAll(), 'Field');
    if (!in_array('stakeholder_votes', $cols)) {
        $pdo->exec("ALTER TABLE feedback_requests ADD COLUMN stakeholder_votes JSON DEFAULT NULL AFTER responded_by");
    }
} catch (Throwable $e) {}

// ── Helpers ──────────────────────────────────────────────────

function mapProject(array $row): array {
    return [
        'id'            => $row['id'],
        'clientSlug'    => $row['client_slug'] ?? null,
        'clientId'      => $row['client_id'] ?? null,
        'title'         => $row['title'],
        'client'        => $row['client'] ?? '',
        'description'   => $row['description'] ?? '',
        'status'        => $row['status'],
        'startDate'     => $row['start_date'] ?? '',
        'endDate'       => $row['end_date'] ?? '',
        'initialQuote'  => $row['initial_quote'] ?? '',
        'revisedQuote'  => $row['revised_quote'] ?? '',
        'invoiceNumber' => $row['invoice_number'] ?? '',
        'paymentStatus' => $row['payment_status'],
        'notes'         => $row['notes'] ?? '',
        'deliveries'    => json_decode($row['deliveries'] ?? 'null', true) ?? [],
        'shareToken'    => $row['share_token'] ?? null,
        'createdAt'     => $row['created_at'],
    ];
}

function mapTask(array $row): array {
    return [
        'id'               => $row['id'],
        'order'            => (int)$row['task_order'],
        'title'            => $row['title'],
        'description'      => $row['description'] ?? '',
        'date'             => $row['date_label'] ?? '',
        'dateLabel'        => $row['date_label'] ?? '',
        'color'            => $row['color'],
        'status'           => $row['status'] ?? 'open',
        'phaseId'          => $row['phase_id'] ?? null,
        'completedAt'      => $row['completed_at'] ?? null,
        'completedBy'      => $row['completed_by'] ?? null,
        'deadline'         => $row['deadline'] ?? null,
        'estimatedHours'   => isset($row['estimated_hours']) ? (float)$row['estimated_hours'] : null,
        'actualHours'      => isset($row['actual_hours']) ? (float)$row['actual_hours'] : null,
        'subtasks'         => [],
        'feedbackRequests' => [],
        'comments'         => [],
    ];
}

function mapSubtask(array $row): array {
    return [
        'id'        => $row['id'],
        'title'     => $row['title'],
        'completed' => (bool)$row['completed'],
    ];
}

function mapFeedbackRequest(array $row): array {
    return [
        'id'               => $row['id'],
        'type'             => $row['type'],
        'message'          => $row['message'],
        'images'           => $row['images']      ? json_decode($row['images'], true)       : null,
        'options'          => $row['options_json'] ? json_decode($row['options_json'], true) : null,
        'resolved'         => (bool)$row['resolved'],
        'response'         => $row['response'] ?? null,
        'respondedAt'      => $row['responded_at'] ?? null,
        'respondedBy'      => $row['responded_by'] ?? null,
        'deadline'         => $row['deadline'] ?? null,
        'revisionLimit'    => isset($row['revision_limit']) ? (int)$row['revision_limit'] : null,
        'revisionCount'    => (int)($row['revision_count'] ?? 0),
        'guidedQuestions'  => isset($row['guided_questions']) && $row['guided_questions'] ? json_decode($row['guided_questions'], true) : null,
        'responseHistory'  => isset($row['response_history']) && $row['response_history'] ? json_decode($row['response_history'], true) : null,
        'stakeholderVotes' => isset($row['stakeholder_votes']) && $row['stakeholder_votes'] ? json_decode($row['stakeholder_votes'], true) : [],
        'createdAt'        => $row['created_at'],
    ];
}

function mapFeedback(array $row): array {
    return [
        'id'        => $row['id'],
        'taskId'    => $row['task_id'],
        'author'    => $row['author'],
        'comment'   => $row['comment'],
        'status'    => $row['status'],
        'createdAt' => $row['created_at'],
    ];
}

function loadFullProject(PDO $pdo, string $projectId): ?array {
    $stmt = $pdo->prepare('SELECT * FROM projects WHERE id = ? OR client_slug = ?');
    $stmt->execute([$projectId, $projectId]);
    $projectRow = $stmt->fetch();
    if (!$projectRow) return null;

    $project = mapProject($projectRow);

    // Tasks
    $stmt = $pdo->prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY task_order');
    $stmt->execute([$projectId]);
    $taskRows = $stmt->fetchAll();

    $tasks = [];
    $taskIds = [];
    foreach ($taskRows as $row) {
        $tasks[$row['id']] = mapTask($row);
        $taskIds[] = $row['id'];
    }

    if (!empty($taskIds)) {
        $in = implode(',', array_fill(0, count($taskIds), '?'));

        // Subtasks
        $stmt = $pdo->prepare("SELECT * FROM subtasks WHERE task_id IN ($in)");
        $stmt->execute($taskIds);
        foreach ($stmt->fetchAll() as $row) {
            if (isset($tasks[$row['task_id']])) {
                $tasks[$row['task_id']]['subtasks'][] = mapSubtask($row);
            }
        }

        // Feedback requests
        $stmt = $pdo->prepare("SELECT * FROM feedback_requests WHERE task_id IN ($in) ORDER BY created_at");
        $stmt->execute($taskIds);
        foreach ($stmt->fetchAll() as $row) {
            if (isset($tasks[$row['task_id']])) {
                $tasks[$row['task_id']]['feedbackRequests'][] = mapFeedbackRequest($row);
            }
        }

        // Step comments
        try {
            $stmt = $pdo->prepare("SELECT * FROM step_comments WHERE task_id IN ($in) ORDER BY created_at");
            $stmt->execute($taskIds);
            foreach ($stmt->fetchAll() as $row) {
                if (isset($tasks[$row['task_id']])) {
                    $tasks[$row['task_id']]['comments'][] = [
                        'id'         => $row['id'],
                        'taskId'     => $row['task_id'],
                        'authorName' => $row['author_name'],
                        'authorEmail'=> $row['author_email'],
                        'authorRole' => $row['author_role'],
                        'message'    => $row['message'],
                        'createdAt'  => $row['created_at'],
                    ];
                }
            }
        } catch (Throwable $e) {}
    }

    // Task feedbacks (admin reviews)
    $stmt = $pdo->prepare('SELECT * FROM task_feedbacks WHERE project_id = ? ORDER BY created_at');
    $stmt->execute([$projectId]);
    $feedbacks = array_map('mapFeedback', $stmt->fetchAll());

    // Load phases
    $phases = [];
    try {
        $stmt = $pdo->prepare('SELECT * FROM funnel_phases WHERE project_id = ? ORDER BY phase_order');
        $stmt->execute([$projectId]);
        foreach ($stmt->fetchAll() as $row) {
            $phases[] = [
                'id'          => $row['id'],
                'projectId'   => $row['project_id'],
                'title'       => $row['title'],
                'description' => $row['description'] ?? '',
                'phaseOrder'  => (int)$row['phase_order'],
                'budget'      => $row['budget'] !== null ? (float)$row['budget'] : null,
                'status'      => $row['status'],
            ];
        }
    } catch (Throwable $e) {}

    $project['tasks']     = array_values($tasks);
    $project['feedbacks'] = $feedbacks;
    $project['phases']    = $phases;
    return $project;
}

// ── Router ───────────────────────────────────────────────────

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? null;

// GET — list all or single
if ($method === 'GET') {
    if ($id) {
        $project = loadFullProject($pdo, $id);
        if (!$project) fail('Project not found', 404);
        ok($project);
    } else {
        $rows = $pdo->query('SELECT id FROM projects ORDER BY created_at DESC')->fetchAll();
        $projects = [];
        foreach ($rows as $row) {
            $p = loadFullProject($pdo, $row['id']);
            if ($p) $projects[] = $p;
        }
        ok($projects);
    }
}

// POST — create
if ($method === 'POST') {
    $data = body();
    // Honour the client-provided id (UUID) so frontend state and DB share the same id.
    // If no id is provided, generate one server-side.
    $newId = !empty($data['id']) ? $data['id'] : uuid();
    $pdo->prepare('
        INSERT INTO projects (id, title, client, client_slug, client_id, description, status, start_date, end_date,
            initial_quote, revised_quote, invoice_number, payment_status, notes, deliveries)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ')->execute([
        $newId,
        $data['title']         ?? 'Untitled Project',
        $data['client']        ?? null,
        !empty($data['clientSlug']) ? $data['clientSlug'] : null,
        $data['clientId']      ?? null,
        $data['description']   ?? null,
        $data['status']        ?? 'draft',
        $data['startDate']     ?: null,
        $data['endDate']       ?: null,
        $data['initialQuote']  ?? null,
        $data['revisedQuote']  ?? null,
        $data['invoiceNumber'] ?? null,
        $data['paymentStatus'] ?? 'unpaid',
        $data['notes']         ?? null,
        isset($data['deliveries']) ? json_encode($data['deliveries']) : null,
    ]);
    ok(loadFullProject($pdo, $newId));
}

// PUT — update fields
if ($method === 'PUT') {
    if (!$id) fail('Missing id');
    $data = body();

    // Update project-level fields (ignore tasks — handled by tasks.php/sync)
    $fields = [];
    $values = [];
    $map = [
        'title'         => 'title',
        'client'        => 'client',
        'clientSlug'    => 'client_slug',
        'clientId'      => 'client_id',
        'description'   => 'description',
        'status'        => 'status',
        'startDate'     => 'start_date',
        'endDate'       => 'end_date',
        'initialQuote'  => 'initial_quote',
        'revisedQuote'  => 'revised_quote',
        'invoiceNumber' => 'invoice_number',
        'paymentStatus' => 'payment_status',
        'notes'         => 'notes',
    ];
    foreach ($map as $jsKey => $dbCol) {
        if (array_key_exists($jsKey, $data)) {
            $fields[] = "$dbCol = ?";
            $values[] = $data[$jsKey] ?: null;
        }
    }
    if (array_key_exists('deliveries', $data)) {
        $fields[] = "deliveries = ?";
        $values[] = json_encode($data['deliveries'] ?? []);
    }
    if (array_key_exists('shareToken', $data)) {
        $fields[] = "share_token = ?";
        $values[] = $data['shareToken'];
    }
    if (!empty($fields)) {
        $values[] = $id;
        $pdo->prepare('UPDATE projects SET ' . implode(', ', $fields) . ' WHERE id = ?')
            ->execute($values);
    }

    // If tasks are included, sync them (replace all)
    if (isset($data['tasks']) && is_array($data['tasks'])) {
        syncTasks($pdo, $id, $data['tasks']);
    }

    ok(loadFullProject($pdo, $id));
}

// DELETE — remove project (cascade deletes tasks/subtasks/feedbacks)
if ($method === 'DELETE') {
    if (!$id) fail('Missing id');
    $pdo->prepare('DELETE FROM projects WHERE id = ?')->execute([$id]);
    ok();
}

function syncTasks(PDO $pdo, string $projectId, array $tasks): void {
    // Get existing task IDs
    $stmt = $pdo->prepare('SELECT id FROM tasks WHERE project_id = ?');
    $stmt->execute([$projectId]);
    $existingIds = array_column($stmt->fetchAll(), 'id');
    $incomingIds = array_filter(array_column($tasks, 'id'));

    // Delete tasks not in incoming list
    $toDelete = array_diff($existingIds, $incomingIds);
    foreach ($toDelete as $delId) {
        $pdo->prepare('DELETE FROM tasks WHERE id = ?')->execute([$delId]);
    }

    foreach ($tasks as $task) {
        $taskId = $task['id'] ?? uuid();
        $isNew  = !in_array($taskId, $existingIds);

        if ($isNew) {
            $pdo->prepare('
                INSERT INTO tasks (id, project_id, title, description, task_order, date_label, color, status, phase_id, completed_at, completed_by, deadline, estimated_hours, actual_hours)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ')->execute([
                $taskId, $projectId,
                $task['title']       ?? '',
                $task['description'] ?? null,
                $task['order']       ?? 0,
                $task['dateLabel']   ?? null,
                $task['color']       ?? 'primary',
                $task['status']      ?? 'open',
                $task['phaseId']     ?? null,
                $task['completedAt'] ?? null,
                $task['completedBy'] ?? null,
                $task['deadline']    ?? null,
                isset($task['estimatedHours']) ? (float)$task['estimatedHours'] : null,
                isset($task['actualHours'])    ? (float)$task['actualHours']    : null,
            ]);
        } else {
            $pdo->prepare('
                UPDATE tasks SET title=?, description=?, task_order=?, date_label=?, color=?, status=?, phase_id=?, completed_at=?, completed_by=?, deadline=?, estimated_hours=?, actual_hours=?
                WHERE id=?
            ')->execute([
                $task['title']       ?? '',
                $task['description'] ?? null,
                $task['order']       ?? 0,
                $task['dateLabel']   ?? null,
                $task['color']       ?? 'primary',
                $task['status']      ?? 'open',
                $task['phaseId']     ?? null,
                $task['completedAt'] ?? null,
                $task['completedBy'] ?? null,
                $task['deadline']    ?? null,
                isset($task['estimatedHours']) ? (float)$task['estimatedHours'] : null,
                isset($task['actualHours'])    ? (float)$task['actualHours']    : null,
                $taskId,
            ]);
        }

        // Sync subtasks
        if (isset($task['subtasks']) && is_array($task['subtasks'])) {
            $pdo->prepare('DELETE FROM subtasks WHERE task_id = ?')->execute([$taskId]);
            foreach ($task['subtasks'] as $st) {
                $pdo->prepare('INSERT INTO subtasks (id, task_id, title, completed) VALUES (?, ?, ?, ?)')
                    ->execute([
                        $st['id']        ?? uuid(),
                        $taskId,
                        $st['title']     ?? '',
                        (int)($st['completed'] ?? false),
                    ]);
            }
        }
    }
}
