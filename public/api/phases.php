<?php
/**
 * phases.php - Project phase CRUD (admin only)
 * Phases group steps in the unified timeline.
 */
require_once __DIR__ . '/_bootstrap.php';
requireAuthForWrites();

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? null;

function mapPhase(array $row): array {
    return [
        'id'          => $row['id'],
        'projectId'   => $row['project_id'],
        'funnelId'    => $row['funnel_id'] ?? null,
        'title'       => $row['title'],
        'description' => $row['description'] ?? '',
        'phaseOrder'  => (int)$row['phase_order'],
        'budget'      => $row['budget'] !== null ? (float)$row['budget'] : null,
        'status'      => $row['status'],
        'startedAt'   => $row['started_at'] ?? null,
        'completedAt' => $row['completed_at'] ?? null,
    ];
}

// ── Auto-migrate: add project_id column ──
try {
    $cols = array_column($pdo->query('SHOW COLUMNS FROM funnel_phases')->fetchAll(), 'Field');
    if (!in_array('project_id', $cols)) {
        $pdo->exec('ALTER TABLE funnel_phases ADD COLUMN project_id VARCHAR(36) DEFAULT NULL AFTER funnel_id');
        $pdo->exec('ALTER TABLE funnel_phases ADD INDEX idx_phase_project_id (project_id)');
        // Backfill from funnels
        $pdo->exec('
            UPDATE funnel_phases fp
            JOIN project_funnels pf ON fp.funnel_id = pf.id
            SET fp.project_id = pf.project_id
        ');
    }
} catch (Throwable $e) {}

// ── GET: list phases for a project ──
if ($method === 'GET') {
    $projectId = $_GET['project_id'] ?? null;
    if (!$projectId) fail('Missing project_id');
    $stmt = $pdo->prepare('SELECT * FROM funnel_phases WHERE project_id = ? ORDER BY phase_order');
    $stmt->execute([$projectId]);
    ok(array_map('mapPhase', $stmt->fetchAll()));
}

// ── POST: create phase ──
if ($method === 'POST') {
    $data = body();
    $projectId = $data['projectId'] ?? null;
    if (!$projectId) fail('Missing projectId');

    // Get next order
    $stmt = $pdo->prepare('SELECT COALESCE(MAX(phase_order), 0) + 1 as next_order FROM funnel_phases WHERE project_id = ?');
    $stmt->execute([$projectId]);
    $nextOrder = (int)$stmt->fetch()['next_order'];

    $newId = uuid();
    $pdo->prepare('
        INSERT INTO funnel_phases (id, project_id, title, description, phase_order, budget, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ')->execute([
        $newId,
        $projectId,
        $data['title'] ?? 'Nouvelle phase',
        $data['description'] ?? null,
        $data['phaseOrder'] ?? $nextOrder,
        $data['budget'] ?? null,
        $data['status'] ?? 'pending',
    ]);

    $stmt = $pdo->prepare('SELECT * FROM funnel_phases WHERE id = ?');
    $stmt->execute([$newId]);
    ok(mapPhase($stmt->fetch()));
}

// ── PUT: update phase ──
if ($method === 'PUT') {
    if (!$id) fail('Missing id');
    $data = body();

    $fields = [];
    $values = [];
    $map = [
        'title'       => 'title',
        'description' => 'description',
        'phaseOrder'  => 'phase_order',
        'budget'      => 'budget',
        'status'      => 'status',
    ];
    foreach ($map as $jsKey => $dbCol) {
        if (array_key_exists($jsKey, $data)) {
            $fields[] = "$dbCol = ?";
            $values[] = $data[$jsKey];
        }
    }

    // Auto-set timestamps
    if (($data['status'] ?? null) === 'active') {
        $fields[] = 'started_at = NOW()';
    }
    if (($data['status'] ?? null) === 'completed') {
        $fields[] = 'completed_at = NOW()';
    }

    if (!empty($fields)) {
        $values[] = $id;
        $pdo->prepare('UPDATE funnel_phases SET ' . implode(', ', $fields) . ' WHERE id = ?')
            ->execute($values);
    }

    $stmt = $pdo->prepare('SELECT * FROM funnel_phases WHERE id = ?');
    $stmt->execute([$id]);
    ok(mapPhase($stmt->fetch()));
}

// ── DELETE: remove phase ──
if ($method === 'DELETE') {
    if (!$id) fail('Missing id');
    // Unlink tasks from this phase
    $pdo->prepare('UPDATE tasks SET phase_id = NULL WHERE phase_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM funnel_phases WHERE id = ?')->execute([$id]);
    ok();
}
