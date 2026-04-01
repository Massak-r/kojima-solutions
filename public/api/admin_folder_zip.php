<?php
// Public endpoint — downloads all PDFs in a shared folder as a ZIP
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

$uploadsDir = realpath(__DIR__ . '/../private_docs');
if (!$uploadsDir) fail('Storage not configured', 500);

// Collect all descendant folder IDs + names for path building
$allFolders = [$folder['id'] => $folder['name']];
$folderParents = [$folder['id'] => null];
$queue = [$folder['id']];
while ($queue) {
    $current = array_shift($queue);
    $stmt = $pdo->prepare('SELECT * FROM admin_doc_folders WHERE parent_id = ?');
    $stmt->execute([$current]);
    foreach ($stmt->fetchAll() as $child) {
        $allFolders[$child['id']] = $child['name'];
        $folderParents[$child['id']] = $child['parent_id'];
        $queue[] = $child['id'];
    }
}

// Build path for a folder ID (relative to root folder)
function folderPath(string $folderId, array $allFolders, array $folderParents, string $rootId): string {
    $parts = [];
    $cur = $folderId;
    while ($cur && $cur !== $rootId) {
        $parts[] = $allFolders[$cur] ?? $cur;
        $cur = $folderParents[$cur] ?? null;
    }
    return implode('/', array_reverse($parts));
}

// Fetch all docs in these folders
$folderIds = array_keys($allFolders);
$placeholders = implode(',', array_fill(0, count($folderIds), '?'));
$stmt = $pdo->prepare("SELECT * FROM admin_docs WHERE folder_id IN ($placeholders) ORDER BY sort_order, created_at DESC");
$stmt->execute($folderIds);
$docs = $stmt->fetchAll();

if (empty($docs)) fail('No documents in this folder', 404);

// Create ZIP
$tmpFile = tempnam(sys_get_temp_dir(), 'kzip_');
$zip = new ZipArchive();
if ($zip->open($tmpFile, ZipArchive::OVERWRITE) !== true) fail('Failed to create ZIP', 500);

foreach ($docs as $doc) {
    $filePath = $uploadsDir . '/' . $doc['filename'];
    if (!file_exists($filePath)) continue;

    // Build a nice path inside the ZIP
    $subPath = folderPath($doc['folder_id'], $allFolders, $folderParents, $folder['id']);
    $zipName = $subPath ? ($subPath . '/' . $doc['original_name']) : $doc['original_name'];

    $zip->addFile($filePath, $zipName);
}

$zip->close();

// Stream it
$zipName = preg_replace('/[^a-zA-Z0-9àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ _\-]/', '', $folder['name']) . '.zip';
header('Content-Type: application/zip');
header('Content-Disposition: attachment; filename="' . $zipName . '"');
header('Content-Length: ' . filesize($tmpFile));
header('Cache-Control: no-store');
readfile($tmpFile);
unlink($tmpFile);
exit;
