<?php
// Public endpoint — serves a shared PDF by token (no auth required)
require_once __DIR__ . '/_bootstrap.php';
header('X-Robots-Tag: noindex, nofollow');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') fail('GET only', 405);

$token = $_GET['token'] ?? null;
if (!$token || !preg_match('/^[a-zA-Z0-9_-]{20,64}$/', $token)) fail('Invalid token', 400);

$stmt = $pdo->prepare('SELECT filename, original_name FROM admin_docs WHERE share_token = ?');
$stmt->execute([$token]);
$doc = $stmt->fetch();
if (!$doc) fail('Document not found or link expired', 404);

$dir = realpath(__DIR__ . '/../private_docs');
if (!$dir) fail('Storage not configured', 500);

$path = $dir . DIRECTORY_SEPARATOR . basename($doc['filename']);
if (!file_exists($path)) fail('File not found', 404);

header('Content-Type: application/pdf');
header('Content-Disposition: inline; filename="' . str_replace('"', '\\"', $doc['original_name']) . '"');
header('Content-Length: ' . filesize($path));
header('Cache-Control: public, max-age=3600');
readfile($path);
exit;
