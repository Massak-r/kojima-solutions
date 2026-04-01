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

$to      = 'massaki@kojima-solutions.ch';
$subject = "Nouveau projet - $name";
$body    = "Nouveau message depuis kojima-solutions.ch\n\n"
         . "Nom: $name\n"
         . "Email: $email\n\n"
         . "Message:\n$message";
$headers = implode("\r\n", [
    "From: noreply@kojima-solutions.ch",
    "Reply-To: $email",
    "Content-Type: text/plain; charset=UTF-8",
    "X-Mailer: PHP/" . phpversion(),
]);

$sent = mail($to, $subject, $body, $headers);

if ($sent) {
    ok(['sent' => true]);
} else {
    fail('Failed to send email', 500);
}
