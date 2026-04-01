<?php
require_once __DIR__ . '/_bootstrap.php';
requireAuthForWrites();

$method     = $_SERVER['REQUEST_METHOD'];
$id         = $_GET['id'] ?? null;
$moveId     = $_GET['move_id'] ?? null;
$stream     = isset($_GET['stream']);
$uploadsDir = realpath(__DIR__ . '/../private_videos') ?: (__DIR__ . '/../private_videos');

$allowedMimes = [
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
    'video/x-matroska', 'video/3gpp', 'video/3gpp2', 'video/mpeg',
    'video/ogg', 'video/x-m4v',
];
$allowedExts  = ['mp4','m4v','mov','webm','avi','mkv','3gp','mpeg','mpg','ogg'];
$maxSize      = 150 * 1024 * 1024; // 150 MB

function mapVideo(array $row): array {
    return [
        'id'           => $row['id'],
        'moveId'       => $row['move_id'],
        'filename'     => $row['filename'],
        'originalName' => $row['original_name'],
        'fileSize'     => (int)$row['file_size'],
        'mimeType'     => $row['mime_type'],
        'trimStart'    => $row['trim_start'] !== null ? (float)$row['trim_start'] : null,
        'trimEnd'      => $row['trim_end']   !== null ? (float)$row['trim_end']   : null,
        'createdAt'    => $row['created_at'],
    ];
}

// ── Stream a video file ──────────────────────────────────────────────────────

if ($method === 'GET' && $id && $stream) {
    $stmt = $pdo->prepare('SELECT * FROM salsa_videos WHERE id = ?');
    $stmt->execute([$id]);
    $video = $stmt->fetch();
    if (!$video) fail('Video not found', 404);

    $path = $uploadsDir . DIRECTORY_SEPARATOR . basename($video['filename']);
    if (!file_exists($path)) fail('File not found', 404);

    $size = filesize($path);
    $mime = $video['mime_type'];

    header('Content-Type: ' . $mime);
    header('Accept-Ranges: bytes');
    header('Cache-Control: private, max-age=3600');

    // Support HTTP Range requests for video seeking
    if (isset($_SERVER['HTTP_RANGE'])) {
        preg_match('/bytes=(\d+)-(\d*)/', $_SERVER['HTTP_RANGE'], $matches);
        $start = (int)$matches[1];
        $end   = $matches[2] !== '' ? (int)$matches[2] : $size - 1;
        $end   = min($end, $size - 1);
        $length = $end - $start + 1;

        http_response_code(206);
        header("Content-Range: bytes $start-$end/$size");
        header("Content-Length: $length");

        $fp = fopen($path, 'rb');
        fseek($fp, $start);
        $remaining = $length;
        while ($remaining > 0 && !feof($fp)) {
            $chunk = min(8192, $remaining);
            echo fread($fp, $chunk);
            $remaining -= $chunk;
            flush();
        }
        fclose($fp);
    } else {
        header('Content-Length: ' . $size);
        readfile($path);
    }
    exit;
}

// ── List videos for a move ───────────────────────────────────────────────────

if ($method === 'GET' && $moveId) {
    $stmt = $pdo->prepare('SELECT * FROM salsa_videos WHERE move_id = ? ORDER BY created_at DESC');
    $stmt->execute([$moveId]);
    ok(array_map('mapVideo', $stmt->fetchAll()));
}

if ($method === 'GET') {
    // List all videos
    $rows = $pdo->query('SELECT * FROM salsa_videos ORDER BY created_at DESC')->fetchAll();
    ok(array_map('mapVideo', $rows));
}

// ── Upload a video ───────────────────────────────────────────────────────────

if ($method === 'POST') {
    $file   = $_FILES['file'] ?? null;
    $mvId   = trim($_POST['move_id'] ?? '');

    if (!$mvId)  fail('move_id is required');
    if (!$file || $file['error'] !== UPLOAD_ERR_OK) {
        $errCode = $file['error'] ?? 'missing';
        fail('No file or upload error: ' . $errCode);
    }

    $mime = mime_content_type($file['tmp_name']);
    $ext  = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION)) ?: 'mp4';

    // Accept only by MIME type (no extension-only fallback)
    if (!in_array($mime, $allowedMimes)) {
        fail('File type not allowed (got ' . $mime . '). Accepted: MP4, WebM, MOV, AVI, MKV');
    }
    if ($file['size'] > $maxSize) {
        fail('File too large (max 150 MB)');
    }
    if (!validateMagicBytes($file['tmp_name'], $mime)) {
        fail('File content does not match its declared video type');
    }
    $videoId  = uuid();
    $filename = $videoId . '.' . $ext;

    if (!is_dir($uploadsDir)) mkdir($uploadsDir, 0750, true);

    $dest = $uploadsDir . '/' . $filename;
    if (!move_uploaded_file($file['tmp_name'], $dest)) {
        fail('Failed to save file', 500);
    }

    $trimStart = isset($_POST['trim_start']) && $_POST['trim_start'] !== '' ? (float)$_POST['trim_start'] : null;
    $trimEnd   = isset($_POST['trim_end'])   && $_POST['trim_end']   !== '' ? (float)$_POST['trim_end']   : null;

    $stmt = $pdo->prepare(
        'INSERT INTO salsa_videos (id, move_id, filename, original_name, file_size, mime_type, trim_start, trim_end, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())'
    );
    $stmt->execute([$videoId, $mvId, $filename, $file['name'], $file['size'], $mime, $trimStart, $trimEnd]);

    $row = $pdo->prepare('SELECT * FROM salsa_videos WHERE id = ?');
    $row->execute([$videoId]);
    ok(mapVideo($row->fetch()));
}

// ── Update trim points ──────────────────────────────────────────────────────

if ($method === 'PUT' && $id) {
    $body = json_decode(file_get_contents('php://input'), true) ?: [];
    $trimStart = isset($body['trimStart']) ? (float)$body['trimStart'] : null;
    $trimEnd   = isset($body['trimEnd'])   ? (float)$body['trimEnd']   : null;

    $stmt = $pdo->prepare('UPDATE salsa_videos SET trim_start = ?, trim_end = ? WHERE id = ?');
    $stmt->execute([$trimStart, $trimEnd, $id]);

    $row = $pdo->prepare('SELECT * FROM salsa_videos WHERE id = ?');
    $row->execute([$id]);
    $video = $row->fetch();
    if (!$video) fail('Video not found', 404);
    ok(mapVideo($video));
}

// ── Delete a video ───────────────────────────────────────────────────────────

if ($method === 'DELETE' && $id) {
    $stmt = $pdo->prepare('SELECT * FROM salsa_videos WHERE id = ?');
    $stmt->execute([$id]);
    $video = $stmt->fetch();
    if ($video) {
        $path = $uploadsDir . '/' . $video['filename'];
        if (file_exists($path)) unlink($path);
        $pdo->prepare('DELETE FROM salsa_videos WHERE id = ?')->execute([$id]);
    }
    ok();
}

fail('Method not allowed', 405);
