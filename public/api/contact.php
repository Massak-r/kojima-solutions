<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

function body(): array {
    $raw = file_get_contents('php://input');
    return $raw ? (json_decode($raw, true) ?? []) : [];
}
function ok(mixed $data = null): void { echo json_encode($data ?? ['ok' => true]); exit; }
function fail(string $msg, int $code = 400): void { http_response_code($code); echo json_encode(['error' => $msg]); exit; }

if ($method !== 'POST') fail('Method not allowed', 405);

$data    = body();
$name    = strip_tags(trim($data['name']    ?? ''));
$email   = strip_tags(trim($data['email']   ?? ''));
$message = strip_tags(trim($data['message'] ?? ''));

// Honeypot spam check — if filled, silently return success (bot caught)
$hp = trim($data['_hp'] ?? '');
if ($hp !== '') {
    ok(['sent' => true]);
}

if (!$name || !$email || !$message) fail('Missing required fields', 400);
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Invalid email', 400);

// Queue email for admin review instead of auto-sending
$configFile = __DIR__ . '/config.php';
if (file_exists($configFile)) {
    require_once $configFile;
    try {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER, DB_PASS,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
        );
        function uuid_contact(): string {
            return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
                mt_rand(0,0xffff),mt_rand(0,0xffff),mt_rand(0,0xffff),
                mt_rand(0,0x0fff)|0x4000,mt_rand(0,0x3fff)|0x8000,
                mt_rand(0,0xffff),mt_rand(0,0xffff),mt_rand(0,0xffff));
        }
        // Auto-create table
        $pdo->exec('CREATE TABLE IF NOT EXISTS email_queue (
            id VARCHAR(36) PRIMARY KEY, recipient_email VARCHAR(255) NOT NULL,
            recipient_name VARCHAR(255) DEFAULT NULL, subject VARCHAR(500) NOT NULL,
            body TEXT NOT NULL, cta_url VARCHAR(500) DEFAULT NULL,
            source VARCHAR(100) NOT NULL DEFAULT "system", project_id VARCHAR(36) DEFAULT NULL,
            status ENUM("pending","sent","discarded") NOT NULL DEFAULT "pending",
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, sent_at DATETIME DEFAULT NULL,
            INDEX idx_status (status, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

        $contactBody = "Nouveau message depuis kojima-solutions.ch\n\n"
            . "Nom: $name\nEmail: $email\n\nMessage:\n$message";

        $pdo->prepare('INSERT INTO email_queue (id, recipient_email, recipient_name, subject, body, source) VALUES (?,?,?,?,?,?)')
            ->execute([uuid_contact(), 'massaki@kojima-solutions.ch', 'Admin', "Nouveau projet - $name", $contactBody, 'contact']);

        ok(['sent' => true]);
    } catch (Throwable $e) {
        fail('Failed to queue email', 500);
    }
} else {
    ok(['sent' => true]);
}
