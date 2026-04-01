<?php
require_once __DIR__ . '/_bootstrap.php';
requireAuthForWrites();

function mapAccess(array $row): array {
    return [
        'id'        => $row['id'],
        'type'      => $row['type'],
        'email'     => $row['email'],
        'createdAt' => $row['created_at'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id']    ?? null;
$type   = $_GET['type']  ?? null;
$email  = $_GET['email'] ?? null;

// GET ?type=figures&email=x@y.com → validate (ok or 403)
// GET ?type=figures → list all authorized emails for type
if ($method === 'GET') {
    if ($type && $email) {
        $stmt = $pdo->prepare('SELECT id FROM salsa_access WHERE type = ? AND email = ?');
        $stmt->execute([$type, strtolower(trim($email))]);
        if ($stmt->fetch()) {
            ok(['ok' => true]);
        } else {
            http_response_code(403);
            echo json_encode(['error' => 'Access denied']);
            exit;
        }
    } elseif ($type) {
        $stmt = $pdo->prepare('SELECT * FROM salsa_access WHERE type = ? ORDER BY created_at ASC');
        $stmt->execute([$type]);
        ok(array_map('mapAccess', $stmt->fetchAll()));
    } else {
        $rows = $pdo->query('SELECT * FROM salsa_access ORDER BY type ASC, created_at ASC')->fetchAll();
        ok(array_map('mapAccess', $rows));
    }
}

// POST { type, email } → add authorized email
if ($method === 'POST') {
    $data  = body();
    $newId = uuid();
    $type  = $data['type']  ?? null;
    $email = strtolower(trim($data['email'] ?? ''));

    if (!$type || !$email) fail('Missing type or email');

    try {
        $pdo->prepare('INSERT INTO salsa_access (id, type, email) VALUES (?, ?, ?)')
            ->execute([$newId, $type, $email]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            // Already exists — return existing row
            $stmt = $pdo->prepare('SELECT * FROM salsa_access WHERE type = ? AND email = ?');
            $stmt->execute([$type, $email]);
            ok(mapAccess($stmt->fetch()));
            exit;
        }
        throw $e;
    }

    $stmt = $pdo->prepare('SELECT * FROM salsa_access WHERE id = ?');
    $stmt->execute([$newId]);
    ok(mapAccess($stmt->fetch()));
}

// DELETE ?id= → remove entry
if ($method === 'DELETE') {
    if (!$id) fail('Missing id');
    $pdo->prepare('DELETE FROM salsa_access WHERE id = ?')->execute([$id]);
    ok();
}
