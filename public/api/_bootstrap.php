<?php
// Shared bootstrap: CORS headers + DB connection + auth
header('Content-Type: application/json; charset=utf-8');

// CORS — restrict to own domain + localhost for dev
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = [
    'https://kojima-solutions.ch',
    'http://localhost:8080',
    'http://localhost:5173',
    'http://localhost:3000',
];
if (in_array($origin, $allowed, true)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header('Access-Control-Allow-Origin: https://kojima-solutions.ch');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$configFile = __DIR__ . '/config.php';
if (!file_exists($configFile)) {
    http_response_code(503);
    echo json_encode(['error' => 'Database not configured. Create api/config.php from config.example.php.']);
    exit;
}
require_once $configFile;

try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER,
        DB_PASS,
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(['error' => 'DB connection failed']);
    exit;
}

function body(): array {
    $raw = file_get_contents('php://input');
    return $raw ? (json_decode($raw, true) ?? []) : [];
}

function ok(mixed $data = null): void {
    echo json_encode($data ?? ['ok' => true]);
    exit;
}

function fail(string $msg, int $code = 400): void {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

function uuid(): string {
    return sprintf(
        '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

/**
 * Require API key authentication.
 * Call this at the top of any protected endpoint.
 */
function requireAuth(): void {
    if (!defined('API_SECRET') || API_SECRET === '') return; // skip if not configured
    $key = $_SERVER['HTTP_X_API_KEY'] ?? '';
    if ($key !== API_SECRET) {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
}

/**
 * Require API key only for write operations (POST/PUT/DELETE).
 * GET requests pass through for public read access.
 */
function requireAuthForWrites(): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        requireAuth();
    }
}

/**
 * Validate file content by checking magic bytes.
 * Returns true if the file's actual bytes match the expected type.
 */
function validateMagicBytes(string $filePath, string $mime): bool {
    $handle = fopen($filePath, 'rb');
    if (!$handle) return false;
    $bytes = fread($handle, 12);
    fclose($handle);
    if ($bytes === false || strlen($bytes) < 4) return false;

    switch ($mime) {
        case 'application/pdf':
            return str_starts_with($bytes, '%PDF');
        case 'image/jpeg':
            return ord($bytes[0]) === 0xFF && ord($bytes[1]) === 0xD8;
        case 'image/png':
            return ord($bytes[0]) === 0x89 && substr($bytes, 1, 3) === 'PNG';
        case 'image/gif':
            return str_starts_with($bytes, 'GIF');
        case 'image/webp':
            return str_starts_with($bytes, 'RIFF') && substr($bytes, 8, 4) === 'WEBP';
        case 'video/mp4':
        case 'video/quicktime':
        case 'video/3gpp':
        case 'video/3gpp2':
        case 'video/x-m4v':
            return str_contains(substr($bytes, 4, 8), 'ftyp');
        case 'video/webm':
        case 'video/x-matroska':
            return ord($bytes[0]) === 0x1A && ord($bytes[1]) === 0x45 && ord($bytes[2]) === 0xDF && ord($bytes[3]) === 0xA3;
        case 'video/x-msvideo':
            return str_starts_with($bytes, 'RIFF') && substr($bytes, 8, 3) === 'AVI';
        case 'video/mpeg':
            return ord($bytes[0]) === 0x00 && ord($bytes[1]) === 0x00 && ord($bytes[2]) === 0x01;
        case 'video/ogg':
            return str_starts_with($bytes, 'OggS');
        default:
            return true; // unknown type, skip check
    }
}
