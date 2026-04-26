<?php
require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('POST only', 405);

$file = $_FILES['file'] ?? null;
if (!$file || $file['error'] !== UPLOAD_ERR_OK) {
    fail('No file or upload error: ' . ($file['error'] ?? 'missing'));
}

// Allowed mime types (SVG excluded — XSS risk)
$allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
$mime    = mime_content_type($file['tmp_name']);
if (!in_array($mime, $allowed)) {
    fail('Only image files are allowed (jpeg, png, gif, webp)');
}
if (!validateMagicBytes($file['tmp_name'], $mime)) {
    fail('File content does not match its declared type');
}

// Max 10 MB
if ($file['size'] > 10 * 1024 * 1024) {
    fail('File too large (max 10 MB)');
}

$ext      = pathinfo($file['name'], PATHINFO_EXTENSION);
$filename = uniqid('img_', true) . '.' . strtolower($ext);
$uploadsDir = __DIR__ . '/../uploads/';

if (!is_dir($uploadsDir)) {
    mkdir($uploadsDir, 0755, true);
}

$dest = $uploadsDir . $filename;
if (!move_uploaded_file($file['tmp_name'], $dest)) {
    fail('Failed to save file', 500);
}

$url = (defined('SITE_URL') ? SITE_URL : 'https://kojima-solutions.ch') . '/uploads/' . $filename;
ok(['url' => $url, 'filename' => $filename]);
