<?php
require_once __DIR__ . '/_bootstrap.php';
requireAuth();

$method     = $_SERVER['REQUEST_METHOD'];
$id         = $_GET['id'] ?? null;
$uploadsDir = realpath(__DIR__ . '/../private_personal_docs') ?: (__DIR__ . '/../private_personal_docs');

function mapDoc(array $row): array {
    return [
        'id'           => $row['id'],
        'title'        => $row['title'],
        'category'     => $row['category'],
        'filename'     => $row['filename'],
        'originalName' => $row['original_name'],
        'fileSize'     => (int)$row['file_size'],
        'createdAt'    => $row['created_at'],
    ];
}

if ($method === 'GET') {
    $rows = $pdo->query('SELECT * FROM personal_docs ORDER BY category, created_at DESC')->fetchAll();
    ok(array_map('mapDoc', $rows));
}

if ($method === 'POST') {
    $file = $_FILES['file'] ?? null;
    if (!$file || $file['error'] !== UPLOAD_ERR_OK) {
        fail('No file or upload error: ' . ($file['error'] ?? 'missing'));
    }

    $mime = mime_content_type($file['tmp_name']);
    if ($mime !== 'application/pdf') fail('Only PDF files are allowed');
    if (!validateMagicBytes($file['tmp_name'], $mime)) fail('File content does not match PDF format');
    if ($file['size'] > 25 * 1024 * 1024) fail('File too large (max 25 MB)');

    $title    = trim($_POST['title']    ?? '') ?: pathinfo($file['name'], PATHINFO_FILENAME);
    $category = trim($_POST['category'] ?? '') ?: 'Général';
    $docId    = uuid();
    $filename = $docId . '.pdf';

    if (!is_dir($uploadsDir)) mkdir($uploadsDir, 0750, true);

    $dest = $uploadsDir . '/' . $filename;
    if (!move_uploaded_file($file['tmp_name'], $dest)) fail('Failed to save file', 500);

    $stmt = $pdo->prepare(
        'INSERT INTO personal_docs (id, title, category, filename, original_name, file_size, created_at) VALUES (?,?,?,?,?,?,NOW())'
    );
    $stmt->execute([$docId, $title, $category, $filename, $file['name'], $file['size']]);

    $row = $pdo->prepare('SELECT * FROM personal_docs WHERE id=?');
    $row->execute([$docId]);
    ok(mapDoc($row->fetch()));
}

if ($method === 'PUT' && $id) {
    $data = body();
    $fields = [];
    $params = [];
    if (isset($data['title']))    { $fields[] = 'title = ?';    $params[] = $data['title']; }
    if (isset($data['category'])) { $fields[] = 'category = ?'; $params[] = $data['category']; }
    if (empty($fields)) fail('Nothing to update');
    $params[] = $id;
    $pdo->prepare('UPDATE personal_docs SET ' . implode(', ', $fields) . ' WHERE id=?')->execute($params);
    $row = $pdo->prepare('SELECT * FROM personal_docs WHERE id=?');
    $row->execute([$id]);
    ok(mapDoc($row->fetch()));
}

if ($method === 'DELETE' && $id) {
    $row = $pdo->prepare('SELECT * FROM personal_docs WHERE id=?');
    $row->execute([$id]);
    $doc = $row->fetch();
    if ($doc) {
        $path = $uploadsDir . '/' . $doc['filename'];
        if (file_exists($path)) unlink($path);
        $pdo->prepare('DELETE FROM personal_docs WHERE id=?')->execute([$id]);
    }
    ok();
}

fail('Method not allowed', 405);
