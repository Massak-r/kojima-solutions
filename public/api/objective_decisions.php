<?php
require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS objective_decisions (
            id           VARCHAR(36) PRIMARY KEY,
            source       ENUM('personal','admin') NOT NULL,
            objective_id VARCHAR(36) NOT NULL,
            title        VARCHAR(255) NOT NULL,
            rationale    TEXT         DEFAULT NULL,
            decided_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_obj (source, objective_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
} catch (Throwable $e) {}

function mapDecision(array $row): array {
    return [
        'id'          => $row['id'],
        'source'      => $row['source'],
        'objectiveId' => $row['objective_id'],
        'title'       => $row['title'],
        'rationale'   => $row['rationale'] ?? null,
        'decidedAt'   => $row['decided_at'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id']           ?? null;
$source = $_GET['source']       ?? null;
$objId  = $_GET['objective_id'] ?? null;

if ($method === 'GET') {
    if (!$source || !$objId) fail('source and objective_id required');
    $stmt = $pdo->prepare('SELECT * FROM objective_decisions WHERE source = ? AND objective_id = ? ORDER BY decided_at DESC');
    $stmt->execute([$source, $objId]);
    ok(array_map('mapDecision', $stmt->fetchAll()));
}

if ($method === 'POST') {
    $data  = body();
    $src   = $data['source']      ?? null;
    $oid   = $data['objectiveId'] ?? null;
    $title = trim($data['title']  ?? '');
    if (!$src || !$oid || !$title) fail('source, objectiveId, title required');

    $newId = uuid();
    $decidedAt = $data['decidedAt'] ?? null;
    if ($decidedAt) {
        $pdo->prepare('INSERT INTO objective_decisions (id, source, objective_id, title, rationale, decided_at) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([$newId, $src, $oid, $title, $data['rationale'] ?? null, $decidedAt]);
    } else {
        $pdo->prepare('INSERT INTO objective_decisions (id, source, objective_id, title, rationale) VALUES (?, ?, ?, ?, ?)')
            ->execute([$newId, $src, $oid, $title, $data['rationale'] ?? null]);
    }

    $stmt = $pdo->prepare('SELECT * FROM objective_decisions WHERE id = ?');
    $stmt->execute([$newId]);
    ok(mapDecision($stmt->fetch()));
}

if ($method === 'PUT') {
    if (!$id) fail('Missing id');
    $data   = body();
    $fields = [];
    $values = [];
    $map = [
        'title'     => ['title = ?',      fn($v) => (string)$v],
        'rationale' => ['rationale = ?',  fn($v) => $v],
        'decidedAt' => ['decided_at = ?', fn($v) => $v],
    ];
    foreach ($map as $key => [$sql, $cast]) {
        if (array_key_exists($key, $data)) {
            $fields[] = $sql;
            $values[] = $cast($data[$key]);
        }
    }
    if (!empty($fields)) {
        $values[] = $id;
        $pdo->prepare('UPDATE objective_decisions SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($values);
    }
    $stmt = $pdo->prepare('SELECT * FROM objective_decisions WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) fail('Not found', 404);
    ok(mapDecision($row));
}

if ($method === 'DELETE') {
    if (!$id) fail('Missing id');
    $pdo->prepare('DELETE FROM objective_decisions WHERE id = ?')->execute([$id]);
    ok();
}

fail('Method not allowed', 405);
