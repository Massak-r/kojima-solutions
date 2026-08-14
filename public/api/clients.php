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
    // Archiving (2026-08-14): a finished client stays in the books for history
    // but must stop being proposed for follow-up. Until now nothing could ever
    // be retired, so /relances kept suggesting clients whose work was long done.
    if (!in_array('archived', $cols)) {
        $pdo->exec("ALTER TABLE clients ADD COLUMN archived TINYINT(1) NOT NULL DEFAULT 0");
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
        'archived'     => (bool)($row['archived'] ?? false),
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
        // The unscoped directory is admin-only. It was fully public until
        // 2026-08-14, exposing every client's name, email and postal address to
        // anyone who knew the URL — and handing out the very address the client
        // portal's email gate checks against. Same rule as quotes.php.
        requireAdminSession(); // admin cookie OR X-API-Key; anonymous is refused
        $rows = $pdo->query('SELECT * FROM clients ORDER BY name ASC')->fetchAll();
        ok(array_map('mapClient', $rows));
    }
}

// __ POST -- create _____________________________________

if ($method === 'POST') {
    $data  = body();
    $newId = !empty($data['id']) ? $data['id'] : uuid();
    $pdo->prepare('
        INSERT INTO clients (id, name, organization, email, phone, address, notes, hourly_rate, archived)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ')->execute([
        $newId,
        $data['name']         ?? '',
        $data['organization'] ?? null,
        $data['email']        ?? null,
        $data['phone']        ?? null,
        $data['address']      ?? null,
        $data['notes']        ?? null,
        normalizeRate($data['hourlyRate'] ?? null),
        !empty($data['archived']) ? 1 : 0,
    ]);
    $stmt = $pdo->prepare('SELECT * FROM clients WHERE id = ?');
    $stmt->execute([$newId]);
    ok(mapClient($stmt->fetch()));
}

// __ PUT -- update ______________________________________

if ($method === 'PUT') {
    if (!$id) fail('Missing id');
    $data = body();

    // Partial update. The context's updateClient() sends only the keys that
    // changed — the archive toggle sends nothing but `archived` — whereas this
    // used to be a blanket full-row UPDATE with `$data['name'] ?? ''`, which
    // blanked every omitted field. Only touch what the caller actually sent.
    $fields = [];
    $values = [];
    foreach (['name', 'organization', 'email', 'phone', 'address', 'notes'] as $col) {
        if (array_key_exists($col, $data)) {
            $fields[] = "$col = ?";
            $values[] = $data[$col];
        }
    }
    if (array_key_exists('hourlyRate', $data)) {
        $fields[] = 'hourly_rate = ?';
        $values[] = normalizeRate($data['hourlyRate']);
    }
    if (array_key_exists('archived', $data)) {
        $fields[] = 'archived = ?';
        $values[] = !empty($data['archived']) ? 1 : 0;
    }

    if ($fields) {
        $values[] = $id;
        $pdo->prepare('UPDATE clients SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($values);
    }
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
