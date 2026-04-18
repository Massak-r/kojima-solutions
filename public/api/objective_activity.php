<?php
require_once __DIR__ . '/_bootstrap.php';
requireAuth();

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

function mapActivity(array $row): array {
    return [
        'id'          => $row['id'],
        'source'      => $row['source'],
        'objectiveId' => $row['objective_id'],
        'kind'        => $row['kind'],
        'payload'     => $row['payload'] ? json_decode($row['payload'], true) : null,
        'createdAt'   => $row['created_at'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'];
$source = $_GET['source']       ?? null;
$objId  = $_GET['objective_id'] ?? null;
$limit  = max(1, min(500, (int)($_GET['limit'] ?? 50)));

if ($method === 'GET') {
    if (!$source || !$objId) fail('source and objective_id required');
    $stmt = $pdo->prepare('SELECT * FROM objective_activity WHERE source = ? AND objective_id = ? ORDER BY created_at DESC LIMIT ' . $limit);
    $stmt->execute([$source, $objId]);
    ok(array_map('mapActivity', $stmt->fetchAll()));
}

if ($method === 'POST') {
    $data = body();
    $src  = $data['source']      ?? null;
    $oid  = $data['objectiveId'] ?? null;
    $kind = $data['kind']        ?? null;
    if (!$src || !$oid || !$kind) fail('source, objectiveId, kind required');

    $newId = uuid();
    $pdo->prepare('INSERT INTO objective_activity (id, source, objective_id, kind, payload) VALUES (?, ?, ?, ?, ?)')
        ->execute([$newId, $src, $oid, $kind, isset($data['payload']) ? json_encode($data['payload']) : null]);

    $stmt = $pdo->prepare('SELECT * FROM objective_activity WHERE id = ?');
    $stmt->execute([$newId]);
    ok(mapActivity($stmt->fetch()));
}

fail('Method not allowed', 405);
