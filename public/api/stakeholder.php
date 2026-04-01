<?php
/**
 * stakeholder.php - Public stakeholder access via share token
 * Returns project steps with pending requests (simplified view)
 * NO auth required
 */
require_once __DIR__ . '/_bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
$token  = $_GET['token'] ?? null;

// ── Auto-migrate: add share_token to projects ──
try {
    $cols = array_column($pdo->query('SHOW COLUMNS FROM projects')->fetchAll(), 'Field');
    if (!in_array('share_token', $cols)) {
        $pdo->exec('ALTER TABLE projects ADD COLUMN share_token VARCHAR(64) DEFAULT NULL AFTER deliveries');
        // Backfill from funnels
        $pdo->exec('
            UPDATE projects p
            JOIN project_funnels pf ON p.id = pf.project_id
            SET p.share_token = pf.share_token
            WHERE pf.share_token IS NOT NULL
        ');
    }
} catch (Throwable $e) {}

// ── Auto-migrate: add status, phase_id, etc to tasks ──
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
} catch (Throwable $e) {}

// ── Auto-migrate: add stakeholder_votes + highlight to feedback_requests ──
try {
    $cols = array_column($pdo->query('SHOW COLUMNS FROM feedback_requests')->fetchAll(), 'Field');
    if (!in_array('stakeholder_votes', $cols)) {
        $pdo->exec("ALTER TABLE feedback_requests ADD COLUMN stakeholder_votes JSON DEFAULT NULL AFTER responded_by");
    }
    if (!in_array('stakeholder_highlight', $cols)) {
        $pdo->exec("ALTER TABLE feedback_requests ADD COLUMN stakeholder_highlight TINYINT(1) NOT NULL DEFAULT 0 AFTER stakeholder_votes");
    }
} catch (Throwable $e) {}

// ── Auto-migrate: create step_comments table ──
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

if ($method !== 'GET') fail('Method not allowed', 405);
if (!$token) fail('Missing token');

// ── Look up project by share token ──
$stmt = $pdo->prepare('SELECT * FROM projects WHERE share_token = ?');
$stmt->execute([$token]);
$project = $stmt->fetch();
if (!$project) fail('Not found', 404);

$projectId = $project['id'];

// ── Load phases ──
$stmt = $pdo->prepare('SELECT * FROM funnel_phases WHERE project_id = ? ORDER BY phase_order');
$stmt->execute([$projectId]);
$phases = [];
foreach ($stmt->fetchAll() as $row) {
    $phases[] = [
        'id'         => $row['id'],
        'title'      => $row['title'],
        'phaseOrder' => (int)$row['phase_order'],
        'budget'     => $row['budget'] !== null ? (float)$row['budget'] : null,
        'status'     => $row['status'],
    ];
}

// ── Load steps (tasks) with requests and comments ──
$stmt = $pdo->prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY task_order');
$stmt->execute([$projectId]);
$taskRows = $stmt->fetchAll();

$steps = [];
$taskIds = [];
foreach ($taskRows as $row) {
    $steps[$row['id']] = [
        'id'          => $row['id'],
        'title'       => $row['title'],
        'description' => $row['description'] ?? '',
        'order'       => (int)$row['task_order'],
        'status'      => $row['status'] ?? 'open',
        'phaseId'     => $row['phase_id'] ?? null,
        'deadline'    => $row['deadline'] ?? null,
        'completedAt' => $row['completed_at'] ?? null,
        'completedBy' => $row['completed_by'] ?? null,
        'requests'    => [],
        'comments'    => [],
    ];
    $taskIds[] = $row['id'];
}

if (!empty($taskIds)) {
    $in = implode(',', array_fill(0, count($taskIds), '?'));

    // Feedback requests
    $stmt = $pdo->prepare("SELECT * FROM feedback_requests WHERE task_id IN ($in) ORDER BY created_at");
    $stmt->execute($taskIds);
    foreach ($stmt->fetchAll() as $row) {
        if (isset($steps[$row['task_id']])) {
            $steps[$row['task_id']]['requests'][] = [
                'id'               => $row['id'],
                'type'             => $row['type'],
                'message'          => $row['message'],
                'images'           => $row['images'] ? json_decode($row['images'], true) : null,
                'options'          => $row['options_json'] ? json_decode($row['options_json'], true) : null,
                'resolved'         => (bool)$row['resolved'],
                'response'         => $row['response'] ?? null,
                'respondedAt'      => $row['responded_at'] ?? null,
                'respondedBy'      => $row['responded_by'] ?? null,
                'deadline'         => $row['deadline'] ?? null,
                'revisionLimit'    => $row['revision_limit'] !== null ? (int)$row['revision_limit'] : null,
                'revisionCount'    => (int)($row['revision_count'] ?? 0),
                'stakeholderVotes' => $row['stakeholder_votes'] ? json_decode($row['stakeholder_votes'], true) : [],
                'stakeholderHighlight' => (bool)($row['stakeholder_highlight'] ?? 0),
                'createdAt'        => $row['created_at'],
            ];
        }
    }

    // Step comments
    $stmt = $pdo->prepare("SELECT * FROM step_comments WHERE task_id IN ($in) ORDER BY created_at");
    $stmt->execute($taskIds);
    foreach ($stmt->fetchAll() as $row) {
        if (isset($steps[$row['task_id']])) {
            $steps[$row['task_id']]['comments'][] = [
                'id'         => $row['id'],
                'authorName' => $row['author_name'],
                'authorRole' => $row['author_role'],
                'message'    => $row['message'],
                'createdAt'  => $row['created_at'],
            ];
        }
    }
}

// ── Track stakeholder access ──
$stName = $_GET['name'] ?? '';
if ($stName) {
    try {
        $pdo->prepare("UPDATE project_stakeholders SET last_accessed_at = NOW() WHERE project_id = ? AND LOWER(name) = LOWER(?)")
            ->execute([$projectId, $stName]);
    } catch (Throwable $e) {} // best-effort, don't block response
}

ok([
    'projectId'    => $projectId,
    'projectTitle' => $project['title'],
    'phases'       => $phases,
    'steps'        => array_values($steps),
]);
