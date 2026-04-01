<?php
require_once __DIR__ . '/_bootstrap.php';

// Auto-migrate: add share_token column if missing
try {
    $pdo->query("SELECT share_token FROM project_funnels LIMIT 1");
} catch (Exception $e) {
    $pdo->exec("ALTER TABLE project_funnels ADD COLUMN share_token VARCHAR(64) DEFAULT NULL");
    $pdo->exec("CREATE INDEX idx_funnel_share_token ON project_funnels(share_token)");
}

// ── Public client action: confirm proposal ─────────────────
$action = $_GET['action'] ?? null;
if ($action === 'confirm' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = body();
    $funnelId = $_GET['id'] ?? null;
    if (!$funnelId) fail('id required');

    // Only allow transition from proposal → active
    $stmt = $pdo->prepare('SELECT status FROM project_funnels WHERE id = ?');
    $stmt->execute([$funnelId]);
    $row = $stmt->fetch();
    if (!$row) fail('Funnel not found', 404);
    if ($row['status'] !== 'proposal') fail('Funnel is not in proposal status');

    $tier = $data['tier'] ?? null;
    $sets = ["status = 'active'"];
    $vals = [];
    if ($tier && in_array($tier, ['essential', 'professional', 'custom'])) {
        $sets[] = 'tier = ?';
        $vals[] = $tier;
    }
    $vals[] = $funnelId;
    $pdo->prepare('UPDATE project_funnels SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
    ok(['confirmed' => true]);
}

requireAuthForWrites();

// ── Mappers ─────────────────────────────────────────────────

function mapFunnel(array $r): array {
    return [
        'id'                 => $r['id'],
        'projectId'          => $r['project_id'],
        'templateId'         => $r['template_id'] ?? null,
        'tier'               => $r['tier'] ?? null,
        'status'             => $r['status'],
        'decisionMakerName'  => $r['decision_maker_name'] ?? null,
        'decisionMakerEmail' => $r['decision_maker_email'] ?? null,
        'shareToken'         => $r['share_token'] ?? null,
        'createdAt'          => $r['created_at'],
        'updatedAt'          => $r['updated_at'],
        'phases'             => [],
    ];
}

function mapPhase(array $r): array {
    return [
        'id'          => $r['id'],
        'funnelId'    => $r['funnel_id'],
        'title'       => $r['title'],
        'description' => $r['description'] ?? '',
        'phaseOrder'  => (int)$r['phase_order'],
        'budget'      => $r['budget'] !== null ? (float)$r['budget'] : null,
        'status'      => $r['status'],
        'startedAt'   => $r['started_at'] ?? null,
        'completedAt' => $r['completed_at'] ?? null,
        'gates'       => [],
    ];
}

function mapGate(array $r): array {
    return [
        'id'            => $r['id'],
        'phaseId'       => $r['phase_id'],
        'title'         => $r['title'],
        'description'   => $r['description'] ?? '',
        'gateType'      => $r['gate_type'],
        'gateOrder'     => (int)$r['gate_order'],
        'status'        => $r['status'],
        'deadline'      => $r['deadline'] ?? null,
        'revisionLimit' => (int)$r['revision_limit'],
        'revisionCount' => (int)$r['revision_count'],
        'approvedAt'    => $r['approved_at'] ?? null,
        'approvedBy'    => $r['approved_by'] ?? null,
        'options'       => [],
        'comments'      => [],
    ];
}

function mapOption(array $r): array {
    $images = json_decode($r['images_json'] ?? 'null', true);
    if (!$images && !empty($r['image_url'])) $images = [$r['image_url']];
    return [
        'id'            => $r['id'],
        'gateId'        => $r['gate_id'],
        'title'         => $r['title'] ?? '',
        'description'   => $r['description'] ?? '',
        'imageUrl'      => $r['image_url'] ?? null,
        'images'        => $images ?: [],
        'linkUrl'       => $r['link_url'] ?? null,
        'isRecommended' => (bool)$r['is_recommended'],
        'isSelected'    => (bool)$r['is_selected'],
        'optionOrder'   => (int)$r['option_order'],
    ];
}

function mapComment(array $r): array {
    return [
        'id'          => $r['id'],
        'gateId'      => $r['gate_id'],
        'authorName'  => $r['author_name'] ?? '',
        'authorEmail' => $r['author_email'] ?? '',
        'authorRole'  => $r['author_role'],
        'message'     => $r['message'],
        'createdAt'   => $r['created_at'],
    ];
}

// ── Load full funnel with nested data ───────────────────────

function loadFullFunnel(PDO $pdo, string $funnelId): ?array {
    $stmt = $pdo->prepare('SELECT * FROM project_funnels WHERE id = ?');
    $stmt->execute([$funnelId]);
    $row = $stmt->fetch();
    if (!$row) return null;

    $funnel = mapFunnel($row);

    // Phases
    $stmt = $pdo->prepare('SELECT * FROM funnel_phases WHERE funnel_id = ? ORDER BY phase_order');
    $stmt->execute([$funnelId]);
    $phases = $stmt->fetchAll();

    $phaseIds = array_column($phases, 'id');
    $gatesMap = [];
    $optionsMap = [];
    $commentsMap = [];

    if ($phaseIds) {
        $in = implode(',', array_fill(0, count($phaseIds), '?'));

        // Gates
        $stmt = $pdo->prepare("SELECT * FROM funnel_gates WHERE phase_id IN ($in) ORDER BY gate_order");
        $stmt->execute($phaseIds);
        foreach ($stmt->fetchAll() as $g) {
            $gatesMap[$g['phase_id']][] = $g;
        }

        // Collect gate IDs
        $gateIds = [];
        foreach ($gatesMap as $gates) {
            foreach ($gates as $g) $gateIds[] = $g['id'];
        }

        if ($gateIds) {
            $inG = implode(',', array_fill(0, count($gateIds), '?'));

            // Options
            $stmt = $pdo->prepare("SELECT * FROM gate_options WHERE gate_id IN ($inG) ORDER BY option_order");
            $stmt->execute($gateIds);
            foreach ($stmt->fetchAll() as $o) {
                $optionsMap[$o['gate_id']][] = $o;
            }

            // Comments
            $stmt = $pdo->prepare("SELECT * FROM gate_comments WHERE gate_id IN ($inG) ORDER BY created_at");
            $stmt->execute($gateIds);
            foreach ($stmt->fetchAll() as $c) {
                $commentsMap[$c['gate_id']][] = $c;
            }
        }
    }

    // Assemble
    foreach ($phases as $p) {
        $phase = mapPhase($p);
        foreach (($gatesMap[$p['id']] ?? []) as $g) {
            $gate = mapGate($g);
            $gate['options']  = array_map('mapOption',  $optionsMap[$g['id']]  ?? []);
            $gate['comments'] = array_map('mapComment', $commentsMap[$g['id']] ?? []);
            $phase['gates'][] = $gate;
        }
        $funnel['phases'][] = $phase;
    }

    return $funnel;
}

// ── Routes ──────────────────────────────────────────────────

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;
$projectId = $_GET['project_id'] ?? null;
$shareToken = $_GET['share_token'] ?? null;

// GET by share token (public stakeholder access)
if ($method === 'GET' && $shareToken) {
    if (!preg_match('/^[a-zA-Z0-9_-]{20,64}$/', $shareToken)) fail('Invalid token', 400);
    $stmt = $pdo->prepare('SELECT id FROM project_funnels WHERE share_token = ?');
    $stmt->execute([$shareToken]);
    $row = $stmt->fetch();
    if (!$row) fail('Funnel not found or link expired', 404);
    $funnel = loadFullFunnel($pdo, $row['id']);
    ok($funnel);
}

// GET by funnel ID
if ($method === 'GET' && $id) {
    $funnel = loadFullFunnel($pdo, $id);
    if (!$funnel) fail('Funnel not found', 404);
    ok($funnel);
}

// GET by project ID
if ($method === 'GET' && $projectId) {
    $stmt = $pdo->prepare('SELECT id FROM project_funnels WHERE project_id = ?');
    $stmt->execute([$projectId]);
    $row = $stmt->fetch();
    if (!$row) { echo 'null'; exit; } // no funnel yet
    $funnel = loadFullFunnel($pdo, $row['id']);
    ok($funnel);
}

// GET list all funnels (summary only)
if ($method === 'GET') {
    $stmt = $pdo->query('SELECT f.*, p.title AS project_title FROM project_funnels f LEFT JOIN projects p ON p.id = f.project_id ORDER BY f.updated_at DESC');
    $rows = $stmt->fetchAll();
    $result = array_map(function($r) {
        $f = mapFunnel($r);
        $f['projectTitle'] = $r['project_title'] ?? '';
        return $f;
    }, $rows);
    ok($result);
}

// POST — create funnel for a project
if ($method === 'POST') {
    $data = body();
    $pId = $data['projectId'] ?? '';
    if (!$pId) fail('projectId required');

    // Check project exists
    $stmt = $pdo->prepare('SELECT id FROM projects WHERE id = ?');
    $stmt->execute([$pId]);
    if (!$stmt->fetch()) fail('Project not found', 404);

    // Check no funnel yet
    $stmt = $pdo->prepare('SELECT id FROM project_funnels WHERE project_id = ?');
    $stmt->execute([$pId]);
    if ($stmt->fetch()) fail('Funnel already exists for this project');

    $fId = uuid();
    $stmt = $pdo->prepare('INSERT INTO project_funnels (id, project_id, template_id, tier, status, decision_maker_name, decision_maker_email) VALUES (?,?,?,?,?,?,?)');
    $stmt->execute([
        $fId, $pId,
        $data['templateId'] ?? null,
        $data['tier'] ?? null,
        $data['status'] ?? 'intake',
        $data['decisionMakerName'] ?? null,
        $data['decisionMakerEmail'] ?? null,
    ]);

    // Create phases if provided
    foreach (($data['phases'] ?? []) as $i => $ph) {
        $phId = uuid();
        $stmt = $pdo->prepare('INSERT INTO funnel_phases (id, funnel_id, title, description, phase_order, budget, status) VALUES (?,?,?,?,?,?,?)');
        $stmt->execute([$phId, $fId, $ph['title'], $ph['description'] ?? '', $i, $ph['budget'] ?? null, $ph['status'] ?? 'pending']);

        foreach (($ph['gates'] ?? []) as $j => $gt) {
            $gId = uuid();
            $stmt = $pdo->prepare('INSERT INTO funnel_gates (id, phase_id, title, description, gate_type, gate_order, status, deadline, revision_limit) VALUES (?,?,?,?,?,?,?,?,?)');
            $stmt->execute([$gId, $phId, $gt['title'], $gt['description'] ?? '', $gt['gateType'] ?? 'approval', $j, $gt['status'] ?? 'locked', $gt['deadline'] ?? null, $gt['revisionLimit'] ?? 2]);

            foreach (($gt['options'] ?? []) as $k => $opt) {
                $oId = uuid();
                $optImagesJson = isset($opt['imagesJson']) ? json_encode($opt['imagesJson']) : null;
                $stmt = $pdo->prepare('INSERT INTO gate_options (id, gate_id, title, description, image_url, images_json, link_url, is_recommended, option_order) VALUES (?,?,?,?,?,?,?,?,?)');
                $stmt->execute([$oId, $gId, $opt['title'] ?? '', $opt['description'] ?? '', $opt['imageUrl'] ?? null, $optImagesJson, $opt['linkUrl'] ?? null, $opt['isRecommended'] ?? false, $k]);
            }
        }
    }

    ok(loadFullFunnel($pdo, $fId));
}

// PUT — update funnel metadata
if ($method === 'PUT' && $id) {
    $data = body();

    // Share / Unshare actions
    $act = $data['action'] ?? null;
    if ($act === 'share') {
        $token = bin2hex(random_bytes(24)); // 48-char hex token
        $pdo->prepare('UPDATE project_funnels SET share_token = ? WHERE id = ?')->execute([$token, $id]);
        $funnel = loadFullFunnel($pdo, $id);
        ok($funnel);
    }
    if ($act === 'unshare') {
        $pdo->prepare('UPDATE project_funnels SET share_token = NULL WHERE id = ?')->execute([$id]);
        $funnel = loadFullFunnel($pdo, $id);
        ok($funnel);
    }

    $sets = [];
    $vals = [];

    foreach (['tier' => 'tier', 'status' => 'status', 'decisionMakerName' => 'decision_maker_name', 'decisionMakerEmail' => 'decision_maker_email', 'templateId' => 'template_id'] as $js => $col) {
        if (array_key_exists($js, $data)) {
            $sets[] = "$col = ?";
            $vals[] = $data[$js];
        }
    }

    if ($sets) {
        $vals[] = $id;
        $sql = 'UPDATE project_funnels SET ' . implode(', ', $sets) . ' WHERE id = ?';
        $pdo->prepare($sql)->execute($vals);
    }

    ok(loadFullFunnel($pdo, $id));
}

// DELETE — remove funnel (cascades)
if ($method === 'DELETE' && $id) {
    $pdo->prepare('DELETE FROM project_funnels WHERE id = ?')->execute([$id]);
    ok();
}

fail('Invalid request', 400);
