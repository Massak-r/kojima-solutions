<?php
require_once __DIR__ . '/_bootstrap.php';

// No auth — public endpoint for client login by email

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') {
    fail('Method not allowed', 405);
}

$d = body();
$email = strtolower(trim($d['email'] ?? ''));

if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fail('Email invalide', 400);
}

// Find client(s) by email
$clientStmt = $pdo->prepare("SELECT id, name, organization, email FROM clients WHERE LOWER(email) = ?");
$clientStmt->execute([$email]);
$clients = $clientStmt->fetchAll();

if (empty($clients)) {
    fail('Aucun projet trouvé pour cet email', 404);
}

// Gather projects for all matching clients
$results = [];
foreach ($clients as $client) {
    $projStmt = $pdo->prepare("SELECT id, title, status, client_slug, updated_at FROM projects WHERE client_id = ? ORDER BY updated_at DESC");
    $projStmt->execute([$client['id']]);
    $projects = $projStmt->fetchAll();

    if (!empty($projects)) {
        $results[] = [
            'client' => [
                'id'           => $client['id'],
                'name'         => $client['name'],
                'organization' => $client['organization'],
            ],
            'projects' => array_map(fn($p) => [
                'id'         => $p['id'],
                'title'      => $p['title'],
                'status'     => $p['status'],
                'clientSlug' => $p['client_slug'],
                'lastActivity' => $p['updated_at'],
            ], $projects),
        ];
    }
}

if (empty($results)) {
    fail('Aucun projet trouvé pour cet email', 404);
}

// Return first match (typically one client per email)
ok($results[0]);
