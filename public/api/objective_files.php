<?php
require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS objective_files (
            id            VARCHAR(36) PRIMARY KEY,
            source        ENUM('personal','admin') NOT NULL,
            objective_id  VARCHAR(36) NOT NULL,
            filename      VARCHAR(255) NOT NULL,
            original_name VARCHAR(255) NOT NULL,
            mime_type     VARCHAR(100) NOT NULL,
            file_size     INT          NOT NULL DEFAULT 0,
            caption       VARCHAR(500) DEFAULT NULL,
            created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_obj (source, objective_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
} catch (Throwable $e) {}

$uploadsDir = __DIR__ . '/../uploads/';
$baseUrl    = (defined('SITE_URL') ? rtrim(SITE_URL, '/') : 'https://kojima-solutions.ch') . '/uploads/';

function mapFile(array $row, string $baseUrl): array {
    return [
        'id'           => $row['id'],
        'source'       => $row['source'],
        'objectiveId'  => $row['objective_id'],
        'filename'     => $row['filename'],
        'originalName' => $row['original_name'],
        'mimeType'     => $row['mime_type'],
        'fileSize'     => (int)$row['file_size'],
        'caption'      => $row['caption'] ?? null,
        'url'          => $baseUrl . $row['filename'],
        'createdAt'    => $row['created_at'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id']           ?? null;
$source = $_GET['source']       ?? null;
$objId  = $_GET['objective_id'] ?? null;

if ($method === 'GET') {
    if (!$source || !$objId) fail('source and objective_id required');
    $stmt = $pdo->prepare('SELECT * FROM objective_files WHERE source = ? AND objective_id = ? ORDER BY created_at DESC');
    $stmt->execute([$source, $objId]);
    $rows = $stmt->fetchAll();
    ok(array_map(fn($r) => mapFile($r, $baseUrl), $rows));
}

if ($method === 'POST') {
    $file = $_FILES['file'] ?? null;
    if (!$file || $file['error'] !== UPLOAD_ERR_OK) {
        fail('No file or upload error: ' . ($file['error'] ?? 'missing'));
    }

    $src = trim($_POST['source']      ?? '');
    $oid = trim($_POST['objectiveId'] ?? '');
    if (!$src || !$oid) fail('source and objectiveId required');

    $allowed = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain', 'text/markdown', 'text/csv',
    ];
    $mime = mime_content_type($file['tmp_name']);
    if (!in_array($mime, $allowed, true)) fail('Unsupported file type: ' . $mime);
    if (!validateMagicBytes($file['tmp_name'], $mime)) fail('File content does not match its declared type');
    if ($file['size'] > 25 * 1024 * 1024) fail('File too large (max 25 MB)');

    $ext      = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!$ext) $ext = 'bin';
    $filename = uniqid('obj_', true) . '.' . $ext;

    if (!is_dir($uploadsDir)) mkdir($uploadsDir, 0755, true);
    $dest = $uploadsDir . $filename;
    if (!move_uploaded_file($file['tmp_name'], $dest)) fail('Failed to save file', 500);

    $newId = uuid();
    $pdo->prepare('INSERT INTO objective_files (id, source, objective_id, filename, original_name, mime_type, file_size, caption) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        ->execute([$newId, $src, $oid, $filename, $file['name'], $mime, $file['size'], $_POST['caption'] ?? null]);

    $stmt = $pdo->prepare('SELECT * FROM objective_files WHERE id = ?');
    $stmt->execute([$newId]);
    ok(mapFile($stmt->fetch(), $baseUrl));
}

if ($method === 'PUT') {
    if (!$id) fail('Missing id');
    $data = body();
    if (!array_key_exists('caption', $data)) fail('Nothing to update');
    $pdo->prepare('UPDATE objective_files SET caption = ? WHERE id = ?')
        ->execute([$data['caption'] ?: null, $id]);
    $stmt = $pdo->prepare('SELECT * FROM objective_files WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) fail('Not found', 404);
    ok(mapFile($row, $baseUrl));
}

if ($method === 'DELETE') {
    if (!$id) fail('Missing id');
    $stmt = $pdo->prepare('SELECT filename FROM objective_files WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if ($row) {
        $path = $uploadsDir . $row['filename'];
        if (file_exists($path)) @unlink($path);
        $pdo->prepare('DELETE FROM objective_files WHERE id = ?')->execute([$id]);
    }
    ok();
}

fail('Method not allowed', 405);
