<?php
require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

$method = $_SERVER['REQUEST_METHOD'];

// GET — list all subscriptions (used by digest.php)
if ($method === 'GET') {
    $rows = $pdo->query('SELECT * FROM push_subscriptions ORDER BY created_at DESC')->fetchAll();
    ok($rows);
}

// POST — store a new push subscription
if ($method === 'POST') {
    $data     = body();
    $endpoint = $data['endpoint'] ?? '';
    $p256dh   = $data['keys']['p256dh'] ?? ($data['p256dh'] ?? '');
    $auth     = $data['keys']['auth'] ?? ($data['auth'] ?? '');

    if (!$endpoint || !$p256dh || !$auth) {
        fail('Missing subscription data (endpoint, keys.p256dh, keys.auth)');
    }

    // Upsert: if endpoint exists, update keys; otherwise insert
    $existing = $pdo->prepare('SELECT id FROM push_subscriptions WHERE endpoint = ?');
    $existing->execute([$endpoint]);

    if ($existing->fetch()) {
        $pdo->prepare('UPDATE push_subscriptions SET p256dh = ?, auth = ? WHERE endpoint = ?')
            ->execute([$p256dh, $auth, $endpoint]);
    } else {
        $pdo->prepare('INSERT INTO push_subscriptions (id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)')
            ->execute([uuid(), $endpoint, $p256dh, $auth]);
    }

    ok(['subscribed' => true]);
}

// DELETE — remove a subscription by endpoint
if ($method === 'DELETE') {
    $data     = body();
    $endpoint = $data['endpoint'] ?? ($_GET['endpoint'] ?? '');

    if (!$endpoint) fail('Missing endpoint');

    $pdo->prepare('DELETE FROM push_subscriptions WHERE endpoint = ?')->execute([$endpoint]);
    ok(['unsubscribed' => true]);
}
