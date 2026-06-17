<?php
require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

// Sales pipeline — leads/prospects before they become clients. The top of the
// funnel the rest of the app (clients → projects → quotes → invoices) lacks.
// Auto-migrate on first hit. Idempotent.
try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS lead (
            id              VARCHAR(36) PRIMARY KEY,
            name            VARCHAR(255) NOT NULL,
            company         VARCHAR(255) NULL,
            email           VARCHAR(255) NULL,
            phone           VARCHAR(64)  NULL,
            source          VARCHAR(64)  NULL,
            status          ENUM('new','contacted','proposal','won','lost') NOT NULL DEFAULT 'new',
            value           INT NOT NULL DEFAULT 0,
            notes           TEXT NULL,
            next_follow_up  DATE NULL,
            converted_client_id VARCHAR(36) NULL,
            created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
} catch (Throwable $e) {}

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? null;

const LEAD_STATUSES = ['new', 'contacted', 'proposal', 'won', 'lost'];

function mapLead(array $r): array {
    return [
        'id'                => $r['id'],
        'name'              => $r['name'],
        'company'           => $r['company'] ?? null,
        'email'             => $r['email'] ?? null,
        'phone'             => $r['phone'] ?? null,
        'source'            => $r['source'] ?? null,
        'status'            => $r['status'] ?? 'new',
        'value'             => (int)($r['value'] ?? 0),
        'notes'             => $r['notes'] ?? null,
        'nextFollowUp'      => $r['next_follow_up'] ?: null,
        'convertedClientId' => $r['converted_client_id'] ?? null,
        'createdAt'         => $r['created_at'],
        'updatedAt'         => $r['updated_at'] ?? $r['created_at'],
    ];
}

if ($method === 'GET') {
    $rows = $pdo->query("SELECT * FROM lead ORDER BY updated_at DESC")->fetchAll();
    ok(array_map('mapLead', $rows));
}

if ($method === 'POST') {
    $b    = body();
    $name = trim((string)($b['name'] ?? ''));
    if ($name === '') fail('name required');
    $status = in_array($b['status'] ?? 'new', LEAD_STATUSES, true) ? $b['status'] : 'new';
    $newId  = uuid();
    $pdo->prepare(
        "INSERT INTO lead (id, name, company, email, phone, source, status, value, notes, next_follow_up)
         VALUES (?,?,?,?,?,?,?,?,?,?)"
    )->execute([
        $newId, $name,
        trim((string)($b['company'] ?? '')) ?: null,
        trim((string)($b['email'] ?? '')) ?: null,
        trim((string)($b['phone'] ?? '')) ?: null,
        trim((string)($b['source'] ?? '')) ?: null,
        $status,
        (int)($b['value'] ?? 0),
        trim((string)($b['notes'] ?? '')) ?: null,
        ($b['nextFollowUp'] ?? null) ?: null,
    ]);
    $row = $pdo->prepare("SELECT * FROM lead WHERE id=?");
    $row->execute([$newId]);
    ok(mapLead($row->fetch()));
}

if ($method === 'PUT' && $id) {
    if (!preg_match('/^[0-9a-f-]{36}$/i', $id)) fail('Invalid id');
    $b = body();
    $map = [
        'name'              => ['name = ?',                fn($v) => trim((string)$v)],
        'company'           => ['company = ?',             fn($v) => trim((string)$v) ?: null],
        'email'             => ['email = ?',               fn($v) => trim((string)$v) ?: null],
        'phone'             => ['phone = ?',               fn($v) => trim((string)$v) ?: null],
        'source'            => ['source = ?',              fn($v) => trim((string)$v) ?: null],
        'status'            => ['status = ?',              fn($v) => in_array($v, LEAD_STATUSES, true) ? $v : 'new'],
        'value'             => ['value = ?',               fn($v) => (int)$v],
        'notes'             => ['notes = ?',               fn($v) => trim((string)$v) ?: null],
        'nextFollowUp'      => ['next_follow_up = ?',      fn($v) => $v ?: null],
        'convertedClientId' => ['converted_client_id = ?', fn($v) => $v ?: null],
    ];
    $fields = [];
    $params = [];
    foreach ($map as $key => [$sql, $cast]) {
        if (array_key_exists($key, $b)) { $fields[] = $sql; $params[] = $cast($b[$key]); }
    }
    if (empty($fields)) fail('Nothing to update');
    $fields[] = 'updated_at = NOW()';
    $params[] = $id;
    $pdo->prepare("UPDATE lead SET " . implode(', ', $fields) . " WHERE id=?")->execute($params);
    $row = $pdo->prepare("SELECT * FROM lead WHERE id=?");
    $row->execute([$id]);
    ok(mapLead($row->fetch()));
}

if ($method === 'DELETE' && $id) {
    if (!preg_match('/^[0-9a-f-]{36}$/i', $id)) fail('Invalid id');
    $pdo->prepare("DELETE FROM lead WHERE id=?")->execute([$id]);
    ok();
}

fail('Method not allowed', 405);
