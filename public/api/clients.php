<?php
require_once __DIR__ . '/_bootstrap.php';
requireAuthForWrites();

// Inline auto-migration for hourly_rate (2026-05-25). Migration runner also
// covers this via 20260525120000_time_billing_loop.sql; this guard makes a
// fresh deploy work even before the runner is triggered.
try {
    $cols = $pdo->query('SHOW COLUMNS FROM clients')->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('hourly_rate', $cols)) {
        $pdo->exec("ALTER TABLE clients ADD COLUMN hourly_rate DECIMAL(10,2) DEFAULT NULL");
    }
} catch (Throwable $e) {}

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
        'hourlyRate'   => isset($row['hourly_rate']) && $row['hourly_rate'] !== null ? (float)$row['hourly_rate'] : null,
        'createdAt'    => $row['created_at'],
    ];
}

/** Coerce a posted hourly rate into a positive number or NULL. */
function normalizeRate($raw) {
    if ($raw === null || $raw === '' || $raw === false) return null;
    if (!is_numeric($raw)) return null;
    $f = (float)$raw;
    return $f > 0 ? $f : null;
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
        INSERT INTO clients (id, name, organization, email, phone, address, notes, hourly_rate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ')->execute([
        $newId,
        $data['name']         ?? '',
        $data['organization'] ?? null,
        $data['email']        ?? null,
        $data['phone']        ?? null,
        $data['address']      ?? null,
        $data['notes']        ?? null,
        normalizeRate($data['hourlyRate'] ?? null),
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
            name = ?, organization = ?, email = ?, phone = ?, address = ?, notes = ?, hourly_rate = ?
        WHERE id = ?
    ')->execute([
        $data['name']         ?? '',
        $data['organization'] ?? null,
        $data['email']        ?? null,
        $data['phone']        ?? null,
        $data['address']      ?? null,
        $data['notes']        ?? null,
        normalizeRate($data['hourlyRate'] ?? null),
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
