<?php
// Public endpoint — returns folder info + docs for a shared folder token (no auth)
require_once __DIR__ . '/_bootstrap.php';
header('X-Robots-Tag: noindex, nofollow');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') fail('GET only', 405);

$token = $_GET['token'] ?? null;
if (!$token || !preg_match('/^[a-zA-Z0-9_-]{20,64}$/', $token)) fail('Invalid token', 400);

// Find folder
$stmt = $pdo->prepare('SELECT * FROM admin_doc_folders WHERE share_token = ?');
$stmt->execute([$token]);
$folder = $stmt->fetch();
if (!$folder) fail('Folder not found or link expired', 404);

// Check expiration
if (!empty($folder['share_expires_at']) && strtotime($folder['share_expires_at']) < time()) {
    fail('Ce lien de partage a expiré', 403);
}

// Collect this folder + all descendant folder IDs
$allFolderIds = [$folder['id']];
$queue = [$folder['id']];
$subFolders = [];
while ($queue) {
    $current = array_shift($queue);
    $stmt = $pdo->prepare('SELECT * FROM admin_doc_folders WHERE parent_id = ? ORDER BY sort_order, name');
    $stmt->execute([$current]);
    foreach ($stmt->fetchAll() as $child) {
        $allFolderIds[] = $child['id'];
        $queue[] = $child['id'];
        $subFolders[] = [
            'id'       => $child['id'],
            'name'     => $child['name'],
            'parentId' => $child['parent_id'],
        ];
    }
}

// Fetch all docs in these folders
$placeholders = implode(',', array_fill(0, count($allFolderIds), '?'));
$stmt = $pdo->prepare("SELECT * FROM admin_docs WHERE folder_id IN ($placeholders) ORDER BY sort_order, created_at DESC");
$stmt->execute($allFolderIds);
$docs = [];
foreach ($stmt->fetchAll() as $row) {
    $docs[] = [
        'id'           => $row['id'],
        'title'        => $row['title'],
        'category'     => $row['category'],
        'folderId'     => $row['folder_id'],
        'year'         => $row['year'] ? (int)$row['year'] : null,
        'filename'     => $row['filename'],
        'originalName' => $row['original_name'],
        'fileSize'     => (int)$row['file_size'],
        'createdAt'    => $row['created_at'],
    ];
}

ok([
    'folder' => [
        'id'   => $folder['id'],
        'name' => $folder['name'],
    ],
    'subFolders' => $subFolders,
    'docs'       => $docs,
]);
