<?php
require_once __DIR__ . '/_bootstrap.php';
requireAuthForWrites();

// __ Helper ______________________________________________

function mapClient(array $row): array {
    return [
        'id'           => $row['id'],
        'name'         => $row['name'],
        'organization' => $row['organization'] ?? null,
        'email'        => $row['email'] ?? null,
        'phone'        => $row['phone'] ?? null,
        'address'      => $row['address'] ?? null,
        'notes'        => $row['notes'] ?? null,
        'createdAt'    => $row['created_at'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? null;

// __ GET ________________________________________________

if ($method === 'GET') {
    if ($id) {
        $stmt = $pdo->prepare('SELECT * FROM clients WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) fail('Client not found', 404);
        ok(mapClient($row));
    } else {
        $rows = $pdo->query('SELECT * FROM clients ORDER BY name ASC')->fetchAll();
        ok(array_map('mapClient', $rows));
    }
}

// __ POST -- create _____________________________________

if ($method === 'POST') {
    $data  = body();
    $newId = !empty($data['id']) ? $data['id'] : uuid();
    $pdo->prepare('
        INSERT INTO clients (id, name, organization, email, phone, address, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ')->execute([
        $newId,
        $data['name']         ?? '',
        $data['organization'] ?? null,
        $data['email']        ?? null,
        $data['phone']        ?? null,
        $data['address']      ?? null,
        $data['notes']        ?? null,
    ]);
    $stmt = $pdo->prepare('SELECT * FROM clients WHERE id = ?');
    $stmt->execute([$newId]);
    ok(mapClient($stmt->fetch()));
}

// __ PUT -- update ______________________________________

if ($method === 'PUT') {
    if (!$id) fail('Missing id');
    $data = body();
    $pdo->prepare('
        UPDATE clients SET
            name = ?, organization = ?, email = ?, phone = ?, address = ?, notes = ?
        WHERE id = ?
    ')->execute([
        $data['name']         ?? '',
        $data['organization'] ?? null,
        $data['email']        ?? null,
        $data['phone']        ?? null,
        $data['address']      ?? null,
        $data['notes']        ?? null,
        $id,
    ]);
    $stmt = $pdo->prepare('SELECT * FROM clients WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) fail('Client not found', 404);
    ok(mapClient($row));
}

// __ DELETE _____________________________________________

if ($method === 'DELETE') {
    if (!$id) fail('Missing id');
    $pdo->prepare('DELETE FROM clients WHERE id = ?')->execute([$id]);
    ok();
}
