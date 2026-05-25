<?php
// Lightweight cookie-validity probe. Called by the SPA at mount when the
// localStorage admin flag is set, so the UI can drop the stale flag and
// redirect to /login the moment the HttpOnly cookie has expired or been
// revoked. Returns 200 + {authenticated:true} when valid, 401 otherwise.
// Never sets cookies, never mutates anything.
require_once __DIR__ . '/_bootstrap.php';

$session = validateAdminSession();
if ($session === null) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['authenticated' => false]);
    exit;
}
ok(['authenticated' => true]);
