<?php
require_once __DIR__ . '/_bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
$projectId = $_GET['project_id'] ?? null;

if (!$projectId) fail('project_id required');

// Ensure table exists
$pdo->exec("CREATE TABLE IF NOT EXISTS project_modules (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL UNIQUE,
  modules_json TEXT DEFAULT '[]',
  maintenance VARCHAR(20) DEFAULT 'none',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)");

function mapModules(array $r): array {
    return [
        'id'          => $r['id'],
        'projectId'   => $r['project_id'],
        'modules'     => json_decode($r['modules_json'], true) ?: [],
        'maintenance' => $r['maintenance'] ?? 'none',
        'createdAt'   => $r['created_at'],
        'updatedAt'   => $r['updated_at'],
    ];
}

// GET — fetch modules for project
if ($method === 'GET') {
    requireAuth();
    $stmt = $pdo->prepare('SELECT * FROM project_modules WHERE project_id = ?');
    $stmt->execute([$projectId]);
    $row = $stmt->fetch();
    ok($row ? mapModules($row) : null);
}

// PUT — create or update modules
if ($method === 'PUT') {
    requireAuth();
    $data = body();

    $modulesJson = json_encode($data['modules'] ?? []);
    $maintenance = $data['maintenance'] ?? 'none';

    $stmt = $pdo->prepare('SELECT id FROM project_modules WHERE project_id = ?');
    $stmt->execute([$projectId]);
    $existing = $stmt->fetch();

    if ($existing) {
        $pdo->prepare('UPDATE project_modules SET modules_json = ?, maintenance = ? WHERE project_id = ?')
            ->execute([$modulesJson, $maintenance, $projectId]);
        $id = $existing['id'];
    } else {
        $id = uuid();
        $pdo->prepare('INSERT INTO project_modules (id, project_id, modules_json, maintenance) VALUES (?, ?, ?, ?)')
            ->execute([$id, $projectId, $modulesJson, $maintenance]);
    }

    $stmt = $pdo->prepare('SELECT * FROM project_modules WHERE id = ?');
    $stmt->execute([$id]);
    ok(mapModules($stmt->fetch()));
}

fail('Method not allowed', 405);
