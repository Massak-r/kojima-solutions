<?php
// Shared bootstrap: CORS headers + DB connection + auth
header('Content-Type: application/json; charset=utf-8');

// CORS — restrict to own domain + localhost for dev
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = [
    'https://kojima-solutions.ch',
    'https://www.kojima-solutions.ch',
    'http://localhost:8080',
    'http://localhost:5173',
    'http://localhost:3000',
];
if (in_array($origin, $allowed, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
} else {
    header('Access-Control-Allow-Origin: https://kojima-solutions.ch');
    header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key, X-Client-Token, X-Admin-Token');

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
    // Accept API key from header OR POST body (body avoids CORS preflight on uploads)
    $key = $_SERVER['HTTP_X_API_KEY'] ?? $_POST['api_key'] ?? '';
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
        requireAdminSession();
    }
}

/**
 * Resolve the admin session from the HttpOnly cookie (preferred) and return
 * ['sessionId' => …] if valid. Falls back to null.
 */
function validateAdminSession(): ?array {
    global $pdo;
    $token = $_COOKIE['kojima_admin_session'] ?? '';
    if (!$token || !preg_match('/^[a-f0-9]{64}$/', $token)) return null;
    try {
        $stmt = $pdo->prepare(
            'SELECT token FROM admin_sessions
             WHERE token = ? AND revoked_at IS NULL AND expires_at > NOW()'
        );
        $stmt->execute([$token]);
        $row = $stmt->fetch();
        return $row ? ['sessionId' => $row['token']] : null;
    } catch (Throwable $e) {
        return null;
    }
}

/**
 * Accept either an admin session cookie (preferred) OR the legacy X-API-Key
 * header so existing endpoints keep working during the cookie rollout.
 *
 * For state-changing requests (anything other than GET/HEAD/OPTIONS) we
 * additionally require a matching CSRF token via the double-submit
 * cookie pattern: the JS-readable `kojima_csrf` cookie value must equal
 * the X-CSRF-Token header (or `csrf` query/body param for sendBeacon and
 * file-form-post paths that can't set headers). SameSite=Lax already
 * blocks the cookie on cross-site POSTs, but this is defence-in-depth.
 */
function requireAdminSession(): void {
    if (validateAdminSession() === null) {
        requireAuth();
        return;
    }
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method === 'GET' || $method === 'HEAD' || $method === 'OPTIONS') return;
    if (!validateCsrfToken()) {
        http_response_code(403);
        echo json_encode(['error' => 'Invalid or missing CSRF token']);
        exit;
    }
}

/**
 * Double-submit cookie check: header (or query/body fallback) must match
 * the kojima_csrf cookie value. Falls back to false if either side is
 * missing — caller decides whether to enforce.
 */
function validateCsrfToken(): bool {
    $cookie = $_COOKIE['kojima_csrf'] ?? '';
    $sent   = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_GET['csrf'] ?? $_POST['csrf'] ?? '';
    if ($cookie === '' || $sent === '') return false;
    return hash_equals($cookie, $sent);
}

/**
 * Resolve the opaque client session token if present (header or query param)
 * and return the associated client_id, or null if missing / invalid / expired.
 * Used to let client-facing endpoints authenticate without leaking a raw email.
 */
function validateClientSession(): ?array {
    global $pdo;
    $token = $_SERVER['HTTP_X_CLIENT_TOKEN'] ?? $_GET['client_token'] ?? '';
    if (!$token || !preg_match('/^[a-f0-9]{64}$/', $token)) return null;
    try {
        $stmt = $pdo->prepare(
            'SELECT client_id FROM client_sessions
             WHERE token = ? AND revoked_at IS NULL AND expires_at > NOW()'
        );
        $stmt->execute([$token]);
        $row = $stmt->fetch();
        return $row ? ['clientId' => $row['client_id']] : null;
    } catch (Throwable $e) {
        return null;
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
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        case 'application/zip':
            return substr($bytes, 0, 4) === "PK\x03\x04";
        case 'application/msword':
        case 'application/vnd.ms-excel':
        case 'application/vnd.ms-powerpoint':
            return substr($bytes, 0, 8) === "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1";
        case 'text/plain':
        case 'text/markdown':
        case 'text/csv':
            return true;
        default:
            return true; // unknown type, skip check
    }
}
