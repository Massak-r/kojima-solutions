<?php
require_once __DIR__ . '/_bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
$projectId = $_GET['project_id'] ?? null;

if (!$projectId) fail('project_id required');

// Ensure table exists
$pdo->exec("CREATE TABLE IF NOT EXISTS project_cadrage (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL UNIQUE,
  objectives TEXT DEFAULT '',
  in_scope TEXT DEFAULT '',
  out_scope TEXT DEFAULT '',
  deliverables TEXT DEFAULT '',
  milestones TEXT DEFAULT '',
  constraints TEXT DEFAULT '',
  budget_validated TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)");

function mapCadrage(array $r): array {
    return [
        'id'              => $r['id'],
        'projectId'       => $r['project_id'],
        'objectives'      => $r['objectives'] ?? '',
        'inScope'         => $r['in_scope'] ?? '',
        'outScope'        => $r['out_scope'] ?? '',
        'deliverables'    => $r['deliverables'] ?? '',
        'milestones'      => $r['milestones'] ?? '',
        'constraints'     => $r['constraints'] ?? '',
        'budgetValidated' => $r['budget_validated'] ?? '',
        'createdAt'       => $r['created_at'],
        'updatedAt'       => $r['updated_at'],
    ];
}

// GET — fetch cadrage for project
if ($method === 'GET') {
    requireAuth();
    $stmt = $pdo->prepare('SELECT * FROM project_cadrage WHERE project_id = ?');
    $stmt->execute([$projectId]);
    $row = $stmt->fetch();
    ok($row ? mapCadrage($row) : null);
}

// PUT — create or update cadrage
if ($method === 'PUT') {
    requireAuth();
    $data = body();

    $stmt = $pdo->prepare('SELECT id FROM project_cadrage WHERE project_id = ?');
    $stmt->execute([$projectId]);
    $existing = $stmt->fetch();

    if ($existing) {
        $pdo->prepare('UPDATE project_cadrage SET
            objectives = ?, in_scope = ?, out_scope = ?, deliverables = ?,
            milestones = ?, constraints = ?, budget_validated = ?
            WHERE project_id = ?
        ')->execute([
            $data['objectives'] ?? '',
            $data['inScope'] ?? '',
            $data['outScope'] ?? '',
            $data['deliverables'] ?? '',
            $data['milestones'] ?? '',
            $data['constraints'] ?? '',
            $data['budgetValidated'] ?? '',
            $projectId,
        ]);
        $id = $existing['id'];
    } else {
        $id = uuid();
        $pdo->prepare('INSERT INTO project_cadrage (id, project_id, objectives, in_scope, out_scope, deliverables, milestones, constraints, budget_validated)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ')->execute([
            $id, $projectId,
            $data['objectives'] ?? '',
            $data['inScope'] ?? '',
            $data['outScope'] ?? '',
            $data['deliverables'] ?? '',
            $data['milestones'] ?? '',
            $data['constraints'] ?? '',
            $data['budgetValidated'] ?? '',
        ]);
    }

    $stmt = $pdo->prepare('SELECT * FROM project_cadrage WHERE id = ?');
    $stmt->execute([$id]);
    ok(mapCadrage($stmt->fetch()));
}

fail('Method not allowed', 405);
