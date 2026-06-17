<?php
require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

// Day-scoped time blocks for the "Aujourd'hui" schedule. Stored as
// minutes-from-midnight so the client math stays trivial and timezone-free.
// Auto-migrate on first hit. Idempotent.
try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS time_block (
            id          VARCHAR(36) PRIMARY KEY,
            day         DATE NOT NULL,
            start_min   SMALLINT UNSIGNED NOT NULL,
            end_min     SMALLINT UNSIGNED NOT NULL,
            title       VARCHAR(255) NOT NULL DEFAULT '',
            color       VARCHAR(16) NULL,
            created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_day (day)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
} catch (Throwable $e) {}

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? null;

function mapBlock(array $r): array {
    return [
        'id'        => $r['id'],
        'day'       => $r['day'],
        'startMin'  => (int)$r['start_min'],
        'endMin'    => (int)$r['end_min'],
        'title'     => $r['title'],
        'color'     => $r['color'] ?? null,
        'createdAt' => $r['created_at'],
    ];
}

function clampMin($v): int {
    $n = (int)$v;
    if ($n < 0) return 0;
    if ($n > 1440) return 1440;
    return $n;
}

if ($method === 'GET') {
    $day = $_GET['day'] ?? '';
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $day)) fail('Invalid or missing day (YYYY-MM-DD)');
    $stmt = $pdo->prepare("SELECT * FROM time_block WHERE day = ? ORDER BY start_min, end_min");
    $stmt->execute([$day]);
    ok(array_map('mapBlock', $stmt->fetchAll()));
}

if ($method === 'POST') {
    $b   = body();
    $day = $b['day'] ?? '';
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $day)) fail('Invalid day');
    $start = clampMin($b['startMin'] ?? 0);
    $end   = clampMin($b['endMin'] ?? 0);
    if ($end <= $start) fail('end must be after start');
    $title = trim((string)($b['title'] ?? ''));
    if (strlen($title) > 255) $title = substr($title, 0, 255);
    $color = isset($b['color']) ? substr((string)$b['color'], 0, 16) : null;

    $newId = uuid();
    $pdo->prepare("INSERT INTO time_block (id, day, start_min, end_min, title, color) VALUES (?,?,?,?,?,?)")
        ->execute([$newId, $day, $start, $end, $title, $color ?: null]);
    $row = $pdo->prepare("SELECT * FROM time_block WHERE id = ?");
    $row->execute([$newId]);
    ok(mapBlock($row->fetch()));
}

if ($method === 'PUT' && $id) {
    if (!preg_match('/^[0-9a-f-]{36}$/i', $id)) fail('Invalid id');
    $b = body();
    $fields = [];
    $params = [];
    if (array_key_exists('startMin', $b)) { $fields[] = 'start_min = ?'; $params[] = clampMin($b['startMin']); }
    if (array_key_exists('endMin', $b))   { $fields[] = 'end_min = ?';   $params[] = clampMin($b['endMin']); }
    if (array_key_exists('title', $b))    { $fields[] = 'title = ?';     $params[] = substr(trim((string)$b['title']), 0, 255); }
    if (array_key_exists('color', $b))    { $fields[] = 'color = ?';     $params[] = $b['color'] ? substr((string)$b['color'], 0, 16) : null; }
    if (empty($fields)) fail('Nothing to update');
    $params[] = $id;
    $pdo->prepare("UPDATE time_block SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
    $row = $pdo->prepare("SELECT * FROM time_block WHERE id = ?");
    $row->execute([$id]);
    ok(mapBlock($row->fetch()));
}

if ($method === 'DELETE' && $id) {
    if (!preg_match('/^[0-9a-f-]{36}$/i', $id)) fail('Invalid id');
    $pdo->prepare("DELETE FROM time_block WHERE id = ?")->execute([$id]);
    ok();
}

fail('Method not allowed', 405);
