<?php
require_once __DIR__ . '/_bootstrap.php';
requireAuth();

try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS objective_notes (
            id           VARCHAR(36) PRIMARY KEY,
            source       ENUM('personal','admin') NOT NULL,
            objective_id VARCHAR(36) NOT NULL,
            title        VARCHAR(255) DEFAULT '',
            content      MEDIUMTEXT  DEFAULT NULL,
            pinned       TINYINT(1)  NOT NULL DEFAULT 0,
            created_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_obj (source, objective_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
} catch (Throwable $e) {}

function mapNote(array $row): array {
    return [
        'id'          => $row['id'],
        'source'      => $row['source'],
        'objectiveId' => $row['objective_id'],
        'title'       => $row['title'] ?? '',
        'content'     => $row['content'] ?? '',
        'pinned'      => (bool)$row['pinned'],
        'createdAt'   => $row['created_at'],
        'updatedAt'   => $row['updated_at'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id']           ?? null;
$source = $_GET['source']       ?? null;
$objId  = $_GET['objective_id'] ?? null;

if ($method === 'GET') {
    if ($id) {
        $stmt = $pdo->prepare('SELECT * FROM objective_notes WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) fail('Not found', 404);
        ok(mapNote($row));
    }
    if (!$source || !$objId) fail('source and objective_id required');
    $stmt = $pdo->prepare('SELECT * FROM objective_notes WHERE source = ? AND objective_id = ? ORDER BY pinned DESC, updated_at DESC');
    $stmt->execute([$source, $objId]);
    ok(array_map('mapNote', $stmt->fetchAll()));
}

if ($method === 'POST') {
    $data = body();
    $src  = $data['source']      ?? null;
    $oid  = $data['objectiveId'] ?? null;
    if (!$src || !$oid) fail('source and objectiveId required');

    $newId = uuid();
    $pdo->prepare('INSERT INTO objective_notes (id, source, objective_id, title, content, pinned) VALUES (?, ?, ?, ?, ?, ?)')
        ->execute([
            $newId, $src, $oid,
            $data['title']   ?? '',
            $data['content'] ?? '',
            (int)(!empty($data['pinned'])),
        ]);

    $stmt = $pdo->prepare('SELECT * FROM objective_notes WHERE id = ?');
    $stmt->execute([$newId]);
    ok(mapNote($stmt->fetch()));
}

if ($method === 'PUT') {
    if (!$id) fail('Missing id');
    $data   = body();
    $fields = [];
    $values = [];
    $map = [
        'title'   => ['title = ?',   fn($v) => (string)$v],
        'content' => ['content = ?', fn($v) => (string)$v],
        'pinned'  => ['pinned = ?',  fn($v) => (int)(bool)$v],
    ];
    foreach ($map as $key => [$sql, $cast]) {
        if (array_key_exists($key, $data)) {
            $fields[] = $sql;
            $values[] = $cast($data[$key]);
        }
    }
    if (!empty($fields)) {
        $values[] = $id;
        $pdo->prepare('UPDATE objective_notes SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($values);
    }
    $stmt = $pdo->prepare('SELECT * FROM objective_notes WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) fail('Not found', 404);
    ok(mapNote($row));
}

if ($method === 'DELETE') {
    if (!$id) fail('Missing id');
    $pdo->prepare('DELETE FROM objective_notes WHERE id = ?')->execute([$id]);
    ok();
}

fail('Method not allowed', 405);
