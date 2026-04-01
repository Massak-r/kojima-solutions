<?php
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/_client_email.php';
requireAuthForWrites();

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? null;

// ── Auto-migrate: add advanced feedback columns ──
try {
    $cols = array_column($pdo->query('SHOW COLUMNS FROM feedback_requests')->fetchAll(), 'Field');
    if (!in_array('deadline', $cols)) {
        $pdo->exec("ALTER TABLE feedback_requests ADD COLUMN deadline DATE DEFAULT NULL AFTER options_json");
    }
    if (!in_array('revision_limit', $cols)) {
        $pdo->exec("ALTER TABLE feedback_requests ADD COLUMN revision_limit INT DEFAULT NULL AFTER deadline");
    }
    if (!in_array('revision_count', $cols)) {
        $pdo->exec("ALTER TABLE feedback_requests ADD COLUMN revision_count INT NOT NULL DEFAULT 0 AFTER revision_limit");
    }
    if (!in_array('guided_questions', $cols)) {
        $pdo->exec("ALTER TABLE feedback_requests ADD COLUMN guided_questions JSON DEFAULT NULL AFTER revision_count");
    }
    if (!in_array('response_history', $cols)) {
        $pdo->exec("ALTER TABLE feedback_requests ADD COLUMN response_history JSON DEFAULT NULL AFTER guided_questions");
    }
    if (!in_array('responded_by', $cols)) {
        $pdo->exec("ALTER TABLE feedback_requests ADD COLUMN responded_by VARCHAR(100) DEFAULT NULL AFTER response_history");
    }
    if (!in_array('stakeholder_highlight', $cols)) {
        $pdo->exec("ALTER TABLE feedback_requests ADD COLUMN stakeholder_highlight TINYINT(1) NOT NULL DEFAULT 0 AFTER responded_by");
    }
} catch (Throwable $e) {}

// GET — list by task
if ($method === 'GET') {
    $taskId = $_GET['task_id'] ?? null;
    if (!$taskId) fail('Missing task_id');
    $stmt = $pdo->prepare('SELECT * FROM feedback_requests WHERE task_id = ? ORDER BY created_at');
    $stmt->execute([$taskId]);
    ok(array_map('mapFR', $stmt->fetchAll()));
}

// POST — create feedback request
if ($method === 'POST') {
    $data   = body();
    $taskId = $data['taskId'] ?? null;
    if (!$taskId) fail('Missing taskId');

    $newId = uuid();
    $pdo->prepare('
        INSERT INTO feedback_requests (id, task_id, type, message, images, options_json, deadline, revision_limit, guided_questions)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ')->execute([
        $newId,
        $taskId,
        $data['type']    ?? 'text',
        $data['message'] ?? '',
        isset($data['images'])          ? json_encode($data['images'])          : null,
        isset($data['options'])         ? json_encode($data['options'])         : null,
        $data['deadline']               ?? null,
        isset($data['revisionLimit'])   ? (int)$data['revisionLimit']           : null,
        isset($data['guidedQuestions']) ? json_encode($data['guidedQuestions']) : null,
    ]);

    // Notify client about new feedback request
    try {
        $stmt2 = $pdo->prepare('
            SELECT t.project_id, p.title as project_title, p.client as client_name,
                   c.email as client_email
            FROM tasks t
            JOIN projects p ON p.id = t.project_id
            LEFT JOIN clients c ON c.id = p.client_id
            WHERE t.id = ?
        ');
        $stmt2->execute([$taskId]);
        $ctx = $stmt2->fetch();
        if ($ctx && !empty($ctx['client_email'])) {
            $portalUrl = (defined('SITE_URL') ? SITE_URL : 'https://kojima-solutions.ch') . '/client/' . $ctx['project_id'];
            sendClientEmail(
                $ctx['client_email'],
                $ctx['project_title'] . ' — Votre avis est demandé',
                "Bonjour,\n\nNous avons besoin de votre retour sur le projet « " . $ctx['project_title'] . " » :\n\n"
                . "→ " . ($data['message'] ?? 'Nouvelle demande de feedback') . "\n\n"
                . "Rendez-vous sur votre espace projet pour répondre :",
                $portalUrl
            );
        }
    } catch (Throwable $e) {}

    $stmt = $pdo->prepare('SELECT * FROM feedback_requests WHERE id = ?');
    $stmt->execute([$newId]);
    ok(mapFR($stmt->fetch()));
}

// PUT — resolve / update response
if ($method === 'PUT') {
    if (!$id) fail('Missing id');
    $data = body();

    // Fetch current state for revision tracking
    $curStmt = $pdo->prepare('SELECT * FROM feedback_requests WHERE id = ?');
    $curStmt->execute([$id]);
    $current = $curStmt->fetch();
    if (!$current) fail('Not found', 404);

    $fields          = [];
    $values          = [];
    $clientResponded = false;

    if (array_key_exists('resolved', $data)) {
        $fields[] = 'resolved = ?';
        $values[] = (int)$data['resolved'];
    }
    if (array_key_exists('response', $data)) {
        $fields[] = 'response = ?';
        $values[] = $data['response'];
        $fields[] = 'responded_at = NOW()';
        $clientResponded = !empty($data['response']);
    }
    if (array_key_exists('respondedBy', $data)) {
        $fields[] = 'responded_by = ?';
        $values[] = $data['respondedBy'];
    }
    if (array_key_exists('stakeholderHighlight', $data)) {
        $fields[] = 'stakeholder_highlight = ?';
        $values[] = (int)(bool)$data['stakeholderHighlight'];
    }

    // Revision tracking: increment counter on "changes" responses
    $isRevision = !empty($data['response']) && str_starts_with($data['response'], 'changes:');
    if ($isRevision) {
        $newCount = (int)($current['revision_count'] ?? 0) + 1;
        $fields[] = 'revision_count = ?';
        $values[] = $newCount;
    }

    // Append to response history (audit log)
    if ($clientResponded) {
        $history = $current['response_history'] ? json_decode($current['response_history'], true) : [];
        $history[] = [
            'id'            => uuid(),
            'response'      => $data['response'],
            'respondedAt'   => date('c'),
            'respondedBy'   => $data['respondedBy'] ?? null,
            'revisionRound' => (int)($current['revision_count'] ?? 0) + ($isRevision ? 1 : 0),
        ];
        $fields[] = 'response_history = ?';
        $values[] = json_encode($history);
    }

    if (!empty($fields)) {
        $values[] = $id;
        $pdo->prepare('UPDATE feedback_requests SET ' . implode(', ', $fields) . ' WHERE id = ?')
            ->execute($values);
    }

    // Log to the notifications queue
    if ($clientResponded) {
        logNotification($pdo, $id, $data['response']);
    }

    $stmt = $pdo->prepare('SELECT * FROM feedback_requests WHERE id = ?');
    $stmt->execute([$id]);
    ok(mapFR($stmt->fetch()));
}

// DELETE
if ($method === 'DELETE') {
    if (!$id) fail('Missing id');
    $pdo->prepare('DELETE FROM feedback_requests WHERE id = ?')->execute([$id]);
    ok();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapFR(array $row): array {
    return [
        'id'               => $row['id'],
        'taskId'           => $row['task_id'],
        'type'             => $row['type'],
        'message'          => $row['message'],
        'images'           => $row['images']            ? json_decode($row['images'], true)            : null,
        'options'          => $row['options_json']       ? json_decode($row['options_json'], true)      : null,
        'guidedQuestions'  => ($row['guided_questions'] ?? null) ? json_decode($row['guided_questions'], true) : null,
        'deadline'         => $row['deadline']           ?? null,
        'revisionLimit'    => isset($row['revision_limit']) ? (int)$row['revision_limit'] : null,
        'revisionCount'    => (int)($row['revision_count'] ?? 0),
        'responseHistory'  => ($row['response_history'] ?? null) ? json_decode($row['response_history'], true) : null,
        'respondedBy'      => $row['responded_by']       ?? null,
        'stakeholderHighlight' => (bool)($row['stakeholder_highlight'] ?? 0),
        'resolved'         => (bool)$row['resolved'],
        'response'         => $row['response']           ?? null,
        'respondedAt'      => $row['responded_at']       ?? null,
        'createdAt'        => $row['created_at'],
    ];
}

/**
 * Insert a row into the notifications queue.
 * The actual email is sent by digest.php (cron every 15-20 min).
 */
function logNotification(PDO $pdo, string $requestId, string $response): void {
    try {
        $stmt = $pdo->prepare('
            SELECT
                fr.message      AS question,
                t.title         AS task_title,
                p.title         AS project_title,
                p.client        AS client_name,
                p.id            AS project_id
            FROM feedback_requests fr
            JOIN tasks    t ON t.id = fr.task_id
            JOIN projects p ON p.id = t.project_id
            WHERE fr.id = ?
        ');
        $stmt->execute([$requestId]);
        $ctx = $stmt->fetch();
        if (!$ctx) return;

        $pdo->prepare('
            INSERT INTO notifications
                (id, project_id, project_title, task_title, client_name, question, response)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ')->execute([
            uuid(),
            $ctx['project_id']    ?? null,
            $ctx['project_title'] ?? '',
            $ctx['task_title']    ?? '',
            $ctx['client_name']   ?? '',
            $ctx['question']      ?? '',
            $response,
        ]);
    } catch (Throwable $e) {
        // Never let this break the API response
    }
}
