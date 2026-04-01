<?php
require_once __DIR__ . '/_bootstrap.php';
requireAuthForWrites();

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? null;

// GET — list by project
if ($method === 'GET') {
    $projectId = $_GET['project_id'] ?? null;
    if (!$projectId) fail('Missing project_id');
    $stmt = $pdo->prepare('SELECT * FROM task_feedbacks WHERE project_id = ? ORDER BY created_at');
    $stmt->execute([$projectId]);
    ok(array_map('mapReview', $stmt->fetchAll()));
}

// POST — create review
if ($method === 'POST') {
    $data = body();
    $newId = uuid();
    $pdo->prepare('
        INSERT INTO task_feedbacks (id, task_id, project_id, author, comment, status)
        VALUES (?, ?, ?, ?, ?, ?)
    ')->execute([
        $newId,
        $data['taskId']    ?? '',
        $data['projectId'] ?? '',
        $data['author']    ?? 'Anonymous',
        $data['comment']   ?? '',
        $data['status']    ?? 'pending',
    ]);
    $stmt = $pdo->prepare('SELECT * FROM task_feedbacks WHERE id = ?');
    $stmt->execute([$newId]);
    ok(mapReview($stmt->fetch()));
}

// PUT — update review
if ($method === 'PUT') {
    if (!$id) fail('Missing id');
    $data = body();
    $pdo->prepare('
        UPDATE task_feedbacks SET comment = ?, status = ? WHERE id = ?
    ')->execute([$data['comment'] ?? '', $data['status'] ?? 'pending', $id]);
    $stmt = $pdo->prepare('SELECT * FROM task_feedbacks WHERE id = ?');
    $stmt->execute([$id]);
    ok(mapReview($stmt->fetch()));
}

// DELETE
if ($method === 'DELETE') {
    if (!$id) fail('Missing id');
    $pdo->prepare('DELETE FROM task_feedbacks WHERE id = ?')->execute([$id]);
    ok();
}

function mapReview(array $row): array {
    return [
        'id'        => $row['id'],
        'taskId'    => $row['task_id'],
        'author'    => $row['author'],
        'comment'   => $row['comment'],
        'status'    => $row['status'],
        'createdAt' => $row['created_at'],
    ];
}
