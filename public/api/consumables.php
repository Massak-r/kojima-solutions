<?php
require_once __DIR__ . '/_bootstrap.php';
requireAuth();

// Migrate bundle_id CHAR(36) → TEXT if needed (for JSON array storage)
try { $pdo->exec('ALTER TABLE consumables MODIFY COLUMN bundle_id TEXT NULL'); } catch (\Exception $e) {}

/** Parse bundle_id field: handles legacy single UUID, JSON array, or null */
function parseBundleIds($raw): array {
    if (!$raw) return [];
    $raw = trim($raw);
    if ($raw[0] === '[') {
        $arr = json_decode($raw, true);
        return is_array($arr) ? array_values(array_filter($arr)) : [];
    }
    // Legacy single UUID
    return [$raw];
}

function encodeBundleIds(array $ids): ?string {
    $ids = array_values(array_filter($ids));
    if (empty($ids)) return null;
    return json_encode($ids);
}

function mapCons(array $row): array {
    return [
        'id'            => $row['id'],
        'name'          => $row['name'],
        'estimatedCost' => (float)$row['estimated_cost'],
        'everyN'        => (int)$row['every_n'],
        'unit'          => $row['unit'],
        'lastPurchased' => $row['last_purchased'] ?? null,
        'bundleIds'     => parseBundleIds($row['bundle_id'] ?? null),
        'createdAt'     => $row['created_at'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? null;

if ($method === 'GET') {
    $rows = $pdo->query('SELECT * FROM consumables ORDER BY created_at ASC')->fetchAll();
    ok(array_map('mapCons', $rows));
}

if ($method === 'POST') {
    $data  = body();
    $newId = uuid();
    // Support both legacy bundleId (string) and new bundleIds (array)
    $bundleIds = [];
    if (isset($data['bundleIds']) && is_array($data['bundleIds'])) {
        $bundleIds = $data['bundleIds'];
    } elseif (!empty($data['bundleId'])) {
        $bundleIds = [$data['bundleId']];
    }
    $pdo->prepare('INSERT INTO consumables (id, name, estimated_cost, every_n, unit, last_purchased, bundle_id) VALUES (?,?,?,?,?,?,?)')
        ->execute([
            $newId,
            $data['name']           ?? '',
            (float)($data['estimatedCost'] ?? 0),
            (int)($data['everyN']   ?? 1),
            $data['unit']           ?? 'weeks',
            $data['lastPurchased']  ?? null,
            encodeBundleIds($bundleIds),
        ]);
    $stmt = $pdo->prepare('SELECT * FROM consumables WHERE id = ?');
    $stmt->execute([$newId]);
    ok(mapCons($stmt->fetch()));
}

if ($method === 'PUT') {
    if (!$id) fail('Missing id');
    $data   = body();
    $fields = []; $values = [];
    if (array_key_exists('name',          $data)) { $fields[] = 'name = ?';           $values[] = $data['name']; }
    if (array_key_exists('estimatedCost', $data)) { $fields[] = 'estimated_cost = ?'; $values[] = (float)$data['estimatedCost']; }
    if (array_key_exists('everyN',        $data)) { $fields[] = 'every_n = ?';        $values[] = (int)$data['everyN']; }
    if (array_key_exists('unit',          $data)) { $fields[] = 'unit = ?';           $values[] = $data['unit']; }
    if (array_key_exists('lastPurchased', $data)) { $fields[] = 'last_purchased = ?'; $values[] = $data['lastPurchased']; }
    // Support both bundleIds (array) and legacy bundleId (string)
    if (array_key_exists('bundleIds', $data)) {
        $fields[] = 'bundle_id = ?';
        $values[] = encodeBundleIds(is_array($data['bundleIds']) ? $data['bundleIds'] : []);
    } elseif (array_key_exists('bundleId', $data)) {
        $fields[] = 'bundle_id = ?';
        $ids = $data['bundleId'] ? [$data['bundleId']] : [];
        $values[] = encodeBundleIds($ids);
    }
    if (!empty($fields)) {
        $values[] = $id;
        $pdo->prepare('UPDATE consumables SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($values);
    }
    $stmt = $pdo->prepare('SELECT * FROM consumables WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) fail('Not found', 404);
    ok(mapCons($row));
}

if ($method === 'DELETE') {
    if (!$id) fail('Missing id');
    $pdo->prepare('DELETE FROM consumables WHERE id = ?')->execute([$id]);
    ok();
}
