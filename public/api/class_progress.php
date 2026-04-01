<?php
require_once __DIR__ . '/_bootstrap.php';
requireAuthForWrites();

function mapProgress(array $row): array {
    return [
        'id'        => $row['id'],
        'classKey'  => $row['class_key'],
        'moveId'    => $row['move_id'],
        'status'    => $row['status'],
        'doneOrder' => $row['done_order'] !== null ? (int)$row['done_order'] : null,
        'doneAt'    => $row['done_at'] ?? null,
        'createdAt' => $row['created_at'],
    ];
}

$method    = $_SERVER['REQUEST_METHOD'];
$id        = $_GET['id']        ?? null;
$classKey  = $_GET['class_key'] ?? null;
$moveId    = $_GET['move_id']   ?? null;

// GET ?class_key=class_1 → all rows for that class
if ($method === 'GET') {
    if ($classKey) {
        $stmt = $pdo->prepare('SELECT * FROM class_progress WHERE class_key = ? ORDER BY done_order ASC, created_at ASC');
        $stmt->execute([$classKey]);
    } else {
        $stmt = $pdo->query('SELECT * FROM class_progress ORDER BY class_key ASC, done_order ASC, created_at ASC');
    }
    ok(array_map('mapProgress', $stmt->fetchAll()));
}

// POST { classKey, moveId, status, doneOrder?, doneAt? } → upsert
if ($method === 'POST') {
    $data = body();
    $ck   = $data['classKey'] ?? null;
    $mid  = $data['moveId']   ?? null;

    if (!$ck || !$mid) fail('Missing classKey or moveId');

    $status    = $data['status']    ?? 'planned';
    $doneOrder = isset($data['doneOrder']) ? (int)$data['doneOrder'] : null;
    $doneAt    = $data['doneAt']    ?? null;
    $newId     = uuid();

    $pdo->prepare('
        INSERT INTO class_progress (id, class_key, move_id, status, done_order, done_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            status     = VALUES(status),
            done_order = VALUES(done_order),
            done_at    = VALUES(done_at)
    ')->execute([$newId, $ck, $mid, $status, $doneOrder, $doneAt]);

    $stmt = $pdo->prepare('SELECT * FROM class_progress WHERE class_key = ? AND move_id = ?');
    $stmt->execute([$ck, $mid]);
    ok(mapProgress($stmt->fetch()));
}

// PUT ?id= { status, doneOrder?, doneAt? } → update row
if ($method === 'PUT') {
    if (!$id) fail('Missing id');
    $data   = body();
    $fields = [];
    $values = [];

    if (array_key_exists('status',    $data)) { $fields[] = 'status = ?';     $values[] = $data['status']; }
    if (array_key_exists('doneOrder', $data)) { $fields[] = 'done_order = ?'; $values[] = $data['doneOrder'] !== null ? (int)$data['doneOrder'] : null; }
    if (array_key_exists('doneAt',    $data)) { $fields[] = 'done_at = ?';    $values[] = $data['doneAt']; }

    if (!empty($fields)) {
        $values[] = $id;
        $pdo->prepare('UPDATE class_progress SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($values);
    }

    $stmt = $pdo->prepare('SELECT * FROM class_progress WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) fail('Progress not found', 404);
    ok(mapProgress($row));
}

// DELETE ?id= OR ?class_key=&move_id=
if ($method === 'DELETE') {
    if ($id) {
        $pdo->prepare('DELETE FROM class_progress WHERE id = ?')->execute([$id]);
    } elseif ($classKey && $moveId) {
        $pdo->prepare('DELETE FROM class_progress WHERE class_key = ? AND move_id = ?')->execute([$classKey, $moveId]);
    } else {
        fail('Missing id or class_key+move_id');
    }
    ok();
}
