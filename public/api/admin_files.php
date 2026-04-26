<?php
// Serves private PDF files — only accessible via this PHP endpoint (private_docs/ is .htaccess protected)
require_once __DIR__ . '/_bootstrap.php';
// Accept API key via query param (files are opened via direct browser navigation, not fetch)
if (isset($_GET['key'])) $_SERVER['HTTP_X_API_KEY'] = $_GET['key'];
requireAdminSession();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') fail('GET only', 405);

$file = $_GET['file'] ?? null;
if (!$file) fail('No file specified');

// Only allow UUID.pdf pattern to prevent path traversal
if (!preg_match('/^[0-9a-f\-]{36}\.pdf$/i', $file)) fail('Invalid filename', 400);

$dir  = realpath(__DIR__ . '/../private_docs');
if (!$dir) fail('Storage not configured', 500);

$path = $dir . DIRECTORY_SEPARATOR . basename($file);
if (!file_exists($path)) fail('File not found', 404);

// Fetch original filename from DB for download
$stmt = $pdo->prepare('SELECT original_name FROM admin_docs WHERE filename = ?');
$stmt->execute([$file]);
$row  = $stmt->fetch();
$origName = $row ? $row['original_name'] : $file;

header('Content-Type: application/pdf');
header('Content-Disposition: inline; filename="' . str_replace('"', '\\"', $origName) . '"');
header('Content-Length: ' . filesize($path));
header('Cache-Control: private, no-store');
readfile($path);
exit;
