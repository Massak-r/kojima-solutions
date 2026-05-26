<?php
require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

$method = $_SERVER['REQUEST_METHOD'];
$projectId = $_GET['project_id'] ?? null;
$id = $_GET['id'] ?? null;

// Ensure table exists
$pdo->exec("CREATE TABLE IF NOT EXISTS meeting_notes (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  title VARCHAR(255) DEFAULT '',
  content TEXT,
  meeting_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)");

// Inline auto-migration for the Claude-MCP intent flag (migration
// 20260526180000_meeting_notes_claude_intent.sql formalises it). Lets a
// fresh deploy work even before the migration runner is triggered.
try {
    $cols = $pdo->query('SHOW COLUMNS FROM meeting_notes')->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('claude_intent', $cols)) {
        $pdo->exec("ALTER TABLE meeting_notes ADD COLUMN claude_intent VARCHAR(255) DEFAULT NULL");
    }
    if (!in_array('claude_requested_at', $cols)) {
        $pdo->exec("ALTER TABLE meeting_notes ADD COLUMN claude_requested_at DATETIME DEFAULT NULL");
        try { $pdo->exec("CREATE INDEX idx_meeting_notes_claude ON meeting_notes (claude_requested_at)"); } catch (Throwable $e) {}
    }
} catch (Throwable $e) {}

function mapNote(array $r): array {
    return [
        'id'                 => $r['id'],
        'projectId'          => $r['project_id'],
        'title'              => $r['title'] ?? '',
        'content'            => $r['content'] ?? '',
        'meetingDate'        => $r['meeting_date'],
        'createdAt'          => $r['created_at'],
        'claudeIntent'       => $r['claude_intent'] ?? null,
        'claudeRequestedAt'  => $r['claude_requested_at'] ?? null,
    ];
}

// GET — list notes for project
if ($method === 'GET' && $projectId) {
    $stmt = $pdo->prepare('SELECT * FROM meeting_notes WHERE project_id = ? ORDER BY meeting_date DESC, created_at DESC');
    $stmt->execute([$projectId]);
    ok(array_map('mapNote', $stmt->fetchAll()));
}

// GET ?pending_claude=1 — list every note flagged for Claude processing.
// Consumed by the MCP tool that powers /process-meeting-notes so Claude
// can fetch the queue without scanning project-by-project.
if ($method === 'GET' && isset($_GET['pending_claude'])) {
    $stmt = $pdo->query(
        'SELECT * FROM meeting_notes
         WHERE claude_requested_at IS NOT NULL
         ORDER BY claude_requested_at ASC',
    );
    ok(array_map('mapNote', $stmt->fetchAll()));
}

// POST — create note
if ($method === 'POST') {
    $data = body();
    $pid = $data['projectId'] ?? $projectId;
    if (!$pid) fail('projectId required');

    $id = uuid();
    $pdo->prepare('INSERT INTO meeting_notes (id, project_id, title, content, meeting_date) VALUES (?, ?, ?, ?, ?)')->execute([
        $id,
        $pid,
        $data['title'] ?? '',
        $data['content'] ?? '',
        $data['meetingDate'] ?? date('Y-m-d'),
    ]);

    $stmt = $pdo->prepare('SELECT * FROM meeting_notes WHERE id = ?');
    $stmt->execute([$id]);
    ok(mapNote($stmt->fetch()));
}

// PUT — update note. Two modes:
//   * Standard edit (title/content/meetingDate)
//   * Claude-intent flip (claudeIntent set → request, null → clear)
if ($method === 'PUT' && $id) {
    $data = body();

    // Targeted intent toggle: lets the operator (and the MCP "clear"
    // call from Claude Code) flip the flag without resending the whole
    // note body. Detected by the presence of `claudeIntent` key alone.
    if (array_key_exists('claudeIntent', $data) && !isset($data['title']) && !isset($data['content']) && !isset($data['meetingDate'])) {
        $intent = $data['claudeIntent'];
        if ($intent === null || $intent === '') {
            $pdo->prepare('UPDATE meeting_notes SET claude_intent = NULL, claude_requested_at = NULL WHERE id = ?')
                ->execute([$id]);
        } else {
            $intent = substr((string)$intent, 0, 255);
            $pdo->prepare('UPDATE meeting_notes SET claude_intent = ?, claude_requested_at = NOW() WHERE id = ?')
                ->execute([$intent, $id]);
        }
        $stmt = $pdo->prepare('SELECT * FROM meeting_notes WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) fail('Not found', 404);
        ok(mapNote($row));
    }

    $pdo->prepare('UPDATE meeting_notes SET title = ?, content = ?, meeting_date = ? WHERE id = ?')->execute([
        $data['title'] ?? '',
        $data['content'] ?? '',
        $data['meetingDate'] ?? date('Y-m-d'),
        $id,
    ]);

    $stmt = $pdo->prepare('SELECT * FROM meeting_notes WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) fail('Not found', 404);
    ok(mapNote($row));
}

// DELETE — remove note
if ($method === 'DELETE' && $id) {
    $pdo->prepare('DELETE FROM meeting_notes WHERE id = ?')->execute([$id]);
    ok();
}

fail('Method not allowed', 405);
