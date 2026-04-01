<?php
require_once __DIR__ . '/_bootstrap.php';
requireAuth();

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

function mapNote(array $r): array {
    return [
        'id'          => $r['id'],
        'projectId'   => $r['project_id'],
        'title'       => $r['title'] ?? '',
        'content'     => $r['content'] ?? '',
        'meetingDate' => $r['meeting_date'],
        'createdAt'   => $r['created_at'],
    ];
}

// GET — list notes for project
if ($method === 'GET' && $projectId) {
    $stmt = $pdo->prepare('SELECT * FROM meeting_notes WHERE project_id = ? ORDER BY meeting_date DESC, created_at DESC');
    $stmt->execute([$projectId]);
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

// PUT — update note
if ($method === 'PUT' && $id) {
    $data = body();
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
