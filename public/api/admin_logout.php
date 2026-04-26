<?php
require_once __DIR__ . '/_bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('POST only', 405);

$token = $_COOKIE['kojima_admin_session'] ?? '';
if ($token && preg_match('/^[a-f0-9]{64}$/', $token)) {
    try {
        $pdo->prepare('UPDATE admin_sessions SET revoked_at = NOW() WHERE token = ? AND revoked_at IS NULL')
            ->execute([$token]);
    } catch (Throwable $e) {}
}

// Clear both cookies regardless
setcookie('kojima_admin_session', '', [
    'expires'  => 1,
    'path'     => '/',
    'httponly' => true,
    'samesite' => 'Lax',
]);
setcookie('kojima_csrf', '', [
    'expires'  => 1,
    'path'     => '/',
    'httponly' => false,
    'samesite' => 'Lax',
]);

ok();
