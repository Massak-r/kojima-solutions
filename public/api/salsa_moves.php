<?php
require_once __DIR__ . '/_bootstrap.php';
requireAuthForWrites();

// Auto-migrate: add created_by column if missing
try {
    $pdo->query("SELECT created_by FROM salsa_moves LIMIT 1");
} catch (Exception $e) {
    $pdo->exec("ALTER TABLE salsa_moves ADD COLUMN created_by VARCHAR(255) DEFAULT NULL");
}

function mapMove(array $row): array {
    return [
        'id'          => $row['id'],
        'type'        => $row['type'],
        'title'       => $row['title'],
        'description' => $row['description'] ?? null,
        'videoUrl'    => $row['video_url']    ?? null,
        'linkUrl'     => $row['link_url']     ?? null,
        'topics'      => $row['topics'] ? json_decode($row['topics'], true) : [],
        'status'      => $row['status'],
        'difficulty'  => (int)($row['difficulty'] ?? 0),
        'sortOrder'   => (int)$row['sort_order'],
        'notes'       => $row['notes']        ?? null,
        'createdBy'   => $row['created_by']   ?? null,
        'createdAt'   => $row['created_at'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id']   ?? null;
$type   = $_GET['type'] ?? null;

// GET — list moves, optionally filtered by type
if ($method === 'GET') {
    if ($type) {
        $stmt = $pdo->prepare('SELECT * FROM salsa_moves WHERE type = ? ORDER BY sort_order ASC, created_at ASC');
        $stmt->execute([$type]);
    } else {
        $stmt = $pdo->query('SELECT * FROM salsa_moves ORDER BY sort_order ASC, created_at ASC');
    }
    ok(array_map('mapMove', $stmt->fetchAll()));
}

// POST — create a move
if ($method === 'POST') {
    $data  = body();
    $newId = uuid();
    $maxOrder = (int)$pdo->query('SELECT COALESCE(MAX(sort_order), -1) FROM salsa_moves')->fetchColumn();

    $pdo->prepare('
        INSERT INTO salsa_moves (id, type, title, description, video_url, link_url, topics, status, sort_order, notes, difficulty, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ')->execute([
        $newId,
        $data['type']        ?? 'figures',
        $data['title']       ?? '',
        $data['description'] ?? null,
        $data['videoUrl']    ?? null,
        $data['linkUrl']     ?? null,
        isset($data['topics']) ? json_encode($data['topics']) : '[]',
        $data['status']      ?? 'learning',
        isset($data['sortOrder']) ? (int)$data['sortOrder'] : $maxOrder + 1,
        $data['notes']       ?? null,
        isset($data['difficulty']) ? (int)$data['difficulty'] : 0,
        $data['createdBy']   ?? null,
    ]);

    $stmt = $pdo->prepare('SELECT * FROM salsa_moves WHERE id = ?');
    $stmt->execute([$newId]);
    ok(mapMove($stmt->fetch()));
}

// PUT — update fields
if ($method === 'PUT') {
    if (!$id) fail('Missing id');
    $data   = body();
    $fields = [];
    $values = [];

    if (array_key_exists('type',        $data)) { $fields[] = 'type = ?';        $values[] = $data['type']; }
    if (array_key_exists('title',       $data)) { $fields[] = 'title = ?';       $values[] = $data['title']; }
    if (array_key_exists('description', $data)) { $fields[] = 'description = ?'; $values[] = $data['description']; }
    if (array_key_exists('videoUrl',    $data)) { $fields[] = 'video_url = ?';   $values[] = $data['videoUrl']; }
    if (array_key_exists('linkUrl',     $data)) { $fields[] = 'link_url = ?';    $values[] = $data['linkUrl']; }
    if (array_key_exists('topics',      $data)) { $fields[] = 'topics = ?';      $values[] = json_encode($data['topics']); }
    if (array_key_exists('status',      $data)) { $fields[] = 'status = ?';      $values[] = $data['status']; }
    if (array_key_exists('sortOrder',   $data)) { $fields[] = 'sort_order = ?';  $values[] = (int)$data['sortOrder']; }
    if (array_key_exists('notes',       $data)) { $fields[] = 'notes = ?';       $values[] = $data['notes']; }
    if (array_key_exists('difficulty',  $data)) { $fields[] = 'difficulty = ?';  $values[] = (int)$data['difficulty']; }

    if (!empty($fields)) {
        $values[] = $id;
        $pdo->prepare('UPDATE salsa_moves SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($values);
    }

    $stmt = $pdo->prepare('SELECT * FROM salsa_moves WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) fail('Move not found', 404);
    ok(mapMove($row));
}

// DELETE
if ($method === 'DELETE') {
    if (!$id) fail('Missing id');
    $pdo->prepare('DELETE FROM salsa_moves WHERE id = ?')->execute([$id]);
    ok();
}
