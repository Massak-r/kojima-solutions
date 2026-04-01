<?php
require_once __DIR__ . '/_bootstrap.php';
requireAuthForWrites();

function mapTemplate(array $r): array {
    return [
        'id'             => $r['id'],
        'name'           => $r['name'],
        'description'    => $r['description'] ?? '',
        'icon'           => $r['icon'] ?? null,
        'defaultTier'    => $r['default_tier'] ?? null,
        'phasesJson'     => $r['phases_json'] ? json_decode($r['phases_json'], true) : [],
        'budgetRangeMin' => $r['budget_range_min'] !== null ? (float)$r['budget_range_min'] : null,
        'budgetRangeMax' => $r['budget_range_max'] !== null ? (float)$r['budget_range_max'] : null,
        'createdAt'      => $r['created_at'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

// GET — list all
if ($method === 'GET' && !$id) {
    $rows = $pdo->query('SELECT * FROM project_templates ORDER BY name')->fetchAll();
    ok(array_map('mapTemplate', $rows));
}

// GET — single
if ($method === 'GET' && $id) {
    $stmt = $pdo->prepare('SELECT * FROM project_templates WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) fail('Template not found', 404);
    ok(mapTemplate($row));
}

// POST — create
if ($method === 'POST') {
    $data = body();
    if (empty($data['name'])) fail('name required');

    $tId = uuid();
    $stmt = $pdo->prepare('INSERT INTO project_templates (id, name, description, icon, default_tier, phases_json, budget_range_min, budget_range_max) VALUES (?,?,?,?,?,?,?,?)');
    $stmt->execute([
        $tId,
        $data['name'],
        $data['description'] ?? '',
        $data['icon'] ?? null,
        $data['defaultTier'] ?? null,
        !empty($data['phasesJson']) ? json_encode($data['phasesJson']) : null,
        $data['budgetRangeMin'] ?? null,
        $data['budgetRangeMax'] ?? null,
    ]);

    $stmt = $pdo->prepare('SELECT * FROM project_templates WHERE id = ?');
    $stmt->execute([$tId]);
    ok(mapTemplate($stmt->fetch()));
}

// PUT — update
if ($method === 'PUT' && $id) {
    $data = body();
    $sets = [];
    $vals = [];
    foreach (['name' => 'name', 'description' => 'description', 'icon' => 'icon', 'defaultTier' => 'default_tier', 'budgetRangeMin' => 'budget_range_min', 'budgetRangeMax' => 'budget_range_max'] as $js => $col) {
        if (array_key_exists($js, $data)) {
            $sets[] = "$col = ?";
            $vals[] = $data[$js];
        }
    }
    if (array_key_exists('phasesJson', $data)) {
        $sets[] = 'phases_json = ?';
        $vals[] = json_encode($data['phasesJson']);
    }
    if ($sets) {
        $vals[] = $id;
        $pdo->prepare('UPDATE project_templates SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
    }

    $stmt = $pdo->prepare('SELECT * FROM project_templates WHERE id = ?');
    $stmt->execute([$id]);
    ok(mapTemplate($stmt->fetch()));
}

// DELETE
if ($method === 'DELETE' && $id) {
    $pdo->prepare('DELETE FROM project_templates WHERE id = ?')->execute([$id]);
    ok();
}

fail('Invalid request', 400);
