<?php
require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

function mapNotification(array $row): array {
    return [
        'id'           => $row['id'],
        'projectId'    => $row['project_id'],
        'projectTitle' => $row['project_title'],
        'taskTitle'    => $row['task_title'],
        'clientName'   => $row['client_name'],
        'question'     => $row['question'],
        'response'     => $row['response'],
        'read'         => (bool)($row['read'] ?? false),
        'readAt'       => $row['read_at'] ?? null,
        'createdAt'    => $row['created_at'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? null;
$action = $_GET['action'] ?? null;

// GET — list recent notifications
if ($method === 'GET') {
    $unreadOnly = isset($_GET['unread']);
    $limit      = min((int)($_GET['limit'] ?? 50), 100);

    $sql = 'SELECT * FROM notifications';
    if ($unreadOnly) {
        $sql .= ' WHERE `read` = 0';
    }
    $sql .= ' ORDER BY created_at DESC LIMIT ' . $limit;

    $rows = $pdo->query($sql)->fetchAll();

    // Also return unread count
    $countStmt = $pdo->query('SELECT COUNT(*) as cnt FROM notifications WHERE `read` = 0');
    $unreadCount = (int)$countStmt->fetch()['cnt'];

    ok(['items' => array_map('mapNotification', $rows), 'unreadCount' => $unreadCount]);
}

// PUT — mark as read
if ($method === 'PUT') {
    if ($action === 'read-all') {
        $pdo->exec("UPDATE notifications SET `read` = 1, read_at = NOW() WHERE `read` = 0");
        ok(['ok' => true]);
    }

    if (!$id) fail('Missing id');
    $pdo->prepare("UPDATE notifications SET `read` = 1, read_at = NOW() WHERE id = ?")->execute([$id]);
    ok(['ok' => true]);
}
