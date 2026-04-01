<?php
require_once __DIR__ . '/_bootstrap.php';
requireAuth();

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? null;

// Ensure table exists
$pdo->exec("CREATE TABLE IF NOT EXISTS consumable_bundles (
  id         CHAR(36) PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  color      VARCHAR(20)  NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

// Ensure bundle_id column on consumables (TEXT for JSON array)
try { $pdo->exec('ALTER TABLE consumables ADD COLUMN bundle_id TEXT NULL'); } catch (\Exception $e) {}
try { $pdo->exec('ALTER TABLE consumables MODIFY COLUMN bundle_id TEXT NULL'); } catch (\Exception $e) {}

function mapBundle(array $row): array {
    return [
        'id'        => $row['id'],
        'name'      => $row['name'],
        'color'     => $row['color'] ?? null,
        'createdAt' => $row['created_at'],
    ];
}

if ($method === 'GET') {
    $rows = $pdo->query('SELECT * FROM consumable_bundles ORDER BY name')->fetchAll();
    ok(array_map('mapBundle', $rows));
}

if ($method === 'POST') {
    $data = body();
    $name = trim($data['name'] ?? '');
    if (!$name) fail('Name is required');
    $bid = uuid();
    $color = $data['color'] ?? null;
    $stmt = $pdo->prepare('INSERT INTO consumable_bundles (id, name, color) VALUES (?, ?, ?)');
    $stmt->execute([$bid, $name, $color]);
    $row = $pdo->prepare('SELECT * FROM consumable_bundles WHERE id = ?');
    $row->execute([$bid]);
    ok(mapBundle($row->fetch()));
}

if ($method === 'PUT' && $id) {
    $data = body();
    $fields = [];
    $params = [];
    if (isset($data['name']))  { $fields[] = 'name = ?';  $params[] = trim($data['name']); }
    if (array_key_exists('color', $data)) { $fields[] = 'color = ?'; $params[] = $data['color']; }
    if (empty($fields)) fail('Nothing to update');
    $params[] = $id;
    $pdo->prepare('UPDATE consumable_bundles SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
    $row = $pdo->prepare('SELECT * FROM consumable_bundles WHERE id = ?');
    $row->execute([$id]);
    ok(mapBundle($row->fetch()));
}

if ($method === 'DELETE' && $id) {
    // Unlink consumables from this bundle (handles JSON arrays)
    $rows = $pdo->query('SELECT id, bundle_id FROM consumables WHERE bundle_id IS NOT NULL')->fetchAll();
    foreach ($rows as $row) {
        $raw = $row['bundle_id'];
        if (!$raw) continue;
        if ($raw[0] === '[') {
            $arr = json_decode($raw, true);
            if (is_array($arr)) {
                $filtered = array_values(array_filter($arr, fn($bid) => $bid !== $id));
                $newVal = empty($filtered) ? null : json_encode($filtered);
                $pdo->prepare('UPDATE consumables SET bundle_id = ? WHERE id = ?')->execute([$newVal, $row['id']]);
            }
        } elseif ($raw === $id) {
            $pdo->prepare('UPDATE consumables SET bundle_id = NULL WHERE id = ?')->execute([$row['id']]);
        }
    }
    $pdo->prepare('DELETE FROM consumable_bundles WHERE id = ?')->execute([$id]);
    ok();
}

fail('Method not allowed', 405);
