<?php
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/_client_email.php';

// Auto-migrate: add images_json column to gate_options if missing
try {
    $pdo->query("SELECT images_json FROM gate_options LIMIT 1");
} catch (Exception $e) {
    $pdo->exec("ALTER TABLE gate_options ADD COLUMN images_json JSON DEFAULT NULL AFTER image_url");
}

// Notify client when a gate opens
function notifyGateOpen(PDO $pdo, string $gateId): void {
    try {
        $stmt = $pdo->prepare('
            SELECT g.title as gate_title, g.gate_type,
                   pf.decision_maker_email, pf.project_id,
                   p.title as project_title
            FROM funnel_gates g
            JOIN funnel_phases fp ON g.phase_id = fp.id
            JOIN project_funnels pf ON fp.funnel_id = pf.id
            JOIN projects p ON pf.project_id = p.id
            WHERE g.id = ?
        ');
        $stmt->execute([$gateId]);
        $info = $stmt->fetch();
        if (!$info || empty($info['decision_maker_email'])) return;

        $typeLabels = ['approval' => 'validation', 'choice' => 'choix', 'feedback' => 'retour'];
        $typeLabel = $typeLabels[$info['gate_type']] ?? 'action';
        $portalUrl = (defined('SITE_URL') ? SITE_URL : 'https://kojima-solutions.ch') . '/client/' . $info['project_id'] . '/decision/' . $gateId;

        sendClientEmail(
            $info['decision_maker_email'],
            $info['project_title'] . ' — Action requise : ' . $info['gate_title'],
            "Bonjour,\n\n"
            . "Une nouvelle étape nécessite votre $typeLabel sur le projet « " . $info['project_title'] . " » :\n\n"
            . "→ " . $info['gate_title'] . "\n\n"
            . "Rendez-vous sur votre espace projet pour continuer :",
            $portalUrl
        );
    } catch (Throwable $e) {}
}

// Gate reads are public (client portal), writes need auth for admin actions
$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;
$action = $_GET['action'] ?? null;

// ── Phase CRUD (admin) ──────────────────────────────────────

if ($method === 'POST' && ($action === 'phase')) {
    requireAuth();
    $data = body();
    $funnelId = $data['funnelId'] ?? '';
    if (!$funnelId) fail('funnelId required');

    $phId = uuid();
    $order = (int)($data['phaseOrder'] ?? 0);
    $stmt = $pdo->prepare('INSERT INTO funnel_phases (id, funnel_id, title, description, phase_order, budget, status) VALUES (?,?,?,?,?,?,?)');
    $stmt->execute([$phId, $funnelId, $data['title'] ?? 'New Phase', $data['description'] ?? '', $order, $data['budget'] ?? null, 'pending']);

    $stmt = $pdo->prepare('SELECT * FROM funnel_phases WHERE id = ?');
    $stmt->execute([$phId]);
    ok(mapPhaseRow($stmt->fetch()));
}

if ($method === 'PUT' && $id && ($action === 'phase')) {
    requireAuth();
    $data = body();
    $sets = [];
    $vals = [];
    foreach (['title' => 'title', 'description' => 'description', 'phaseOrder' => 'phase_order', 'budget' => 'budget', 'status' => 'status'] as $js => $col) {
        if (array_key_exists($js, $data)) {
            $sets[] = "$col = ?";
            $vals[] = $data[$js];
        }
    }
    if ($data['status'] ?? '' === 'active' && !isset($data['startedAt'])) {
        $sets[] = 'started_at = NOW()';
    }
    if ($data['status'] ?? '' === 'completed' && !isset($data['completedAt'])) {
        $sets[] = 'completed_at = NOW()';
    }
    if ($sets) {
        $vals[] = $id;
        $pdo->prepare('UPDATE funnel_phases SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
    }
    $stmt = $pdo->prepare('SELECT * FROM funnel_phases WHERE id = ?');
    $stmt->execute([$id]);
    ok(mapPhaseRow($stmt->fetch()));
}

if ($method === 'DELETE' && $id && ($action === 'phase')) {
    requireAuth();
    $pdo->prepare('DELETE FROM funnel_phases WHERE id = ?')->execute([$id]);
    ok();
}

// ── Gate CRUD (admin) ───────────────────────────────────────

if ($method === 'POST' && ($action === 'gate')) {
    requireAuth();
    $data = body();
    $phaseId = $data['phaseId'] ?? '';
    if (!$phaseId) fail('phaseId required');

    $gId = uuid();
    $stmt = $pdo->prepare('INSERT INTO funnel_gates (id, phase_id, title, description, gate_type, gate_order, status, deadline, revision_limit) VALUES (?,?,?,?,?,?,?,?,?)');
    $stmt->execute([$gId, $phaseId, $data['title'] ?? 'New Gate', $data['description'] ?? '', $data['gateType'] ?? 'approval', (int)($data['gateOrder'] ?? 0), $data['status'] ?? 'locked', $data['deadline'] ?? null, (int)($data['revisionLimit'] ?? 2)]);

    $stmt = $pdo->prepare('SELECT * FROM funnel_gates WHERE id = ?');
    $stmt->execute([$gId]);
    ok(mapGateRow($stmt->fetch()));
}

if ($method === 'PUT' && $id && ($action === 'gate')) {
    requireAuth();
    $data = body();
    $sets = [];
    $vals = [];
    foreach (['title' => 'title', 'description' => 'description', 'gateType' => 'gate_type', 'gateOrder' => 'gate_order', 'status' => 'status', 'deadline' => 'deadline', 'revisionLimit' => 'revision_limit'] as $js => $col) {
        if (array_key_exists($js, $data)) {
            $sets[] = "$col = ?";
            $vals[] = $data[$js];
        }
    }
    if ($sets) {
        $vals[] = $id;
        $pdo->prepare('UPDATE funnel_gates SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
    }
    // Notify client when gate is opened
    if (($data['status'] ?? '') === 'open') {
        notifyGateOpen($pdo, $id);
    }
    $stmt = $pdo->prepare('SELECT * FROM funnel_gates WHERE id = ?');
    $stmt->execute([$id]);
    ok(mapGateRow($stmt->fetch()));
}

if ($method === 'DELETE' && $id && ($action === 'gate')) {
    requireAuth();
    $pdo->prepare('DELETE FROM funnel_gates WHERE id = ?')->execute([$id]);
    ok();
}

// ── Gate Option CRUD (admin) ────────────────────────────────

if ($method === 'POST' && ($action === 'option')) {
    requireAuth();
    $data = body();
    $gateId = $data['gateId'] ?? '';
    if (!$gateId) fail('gateId required');

    $oId = uuid();
    $imagesJson = isset($data['imagesJson']) ? json_encode($data['imagesJson']) : null;
    $stmt = $pdo->prepare('INSERT INTO gate_options (id, gate_id, title, description, image_url, images_json, link_url, is_recommended, option_order) VALUES (?,?,?,?,?,?,?,?,?)');
    $stmt->execute([$oId, $gateId, $data['title'] ?? '', $data['description'] ?? '', $data['imageUrl'] ?? null, $imagesJson, $data['linkUrl'] ?? null, (int)($data['isRecommended'] ?? 0), (int)($data['optionOrder'] ?? 0)]);

    $stmt = $pdo->prepare('SELECT * FROM gate_options WHERE id = ?');
    $stmt->execute([$oId]);
    ok(mapOptionRow($stmt->fetch()));
}

if ($method === 'PUT' && $id && ($action === 'option')) {
    requireAuth();
    $data = body();
    $sets = [];
    $vals = [];
    foreach (['title' => 'title', 'description' => 'description', 'imageUrl' => 'image_url', 'linkUrl' => 'link_url', 'isRecommended' => 'is_recommended', 'isSelected' => 'is_selected', 'optionOrder' => 'option_order'] as $js => $col) {
        if (array_key_exists($js, $data)) {
            $sets[] = "$col = ?";
            $vals[] = is_bool($data[$js]) ? (int)$data[$js] : $data[$js];
        }
    }
    if (array_key_exists('imagesJson', $data)) {
        $sets[] = "images_json = ?";
        $vals[] = json_encode($data['imagesJson']);
    }
    if ($sets) {
        $vals[] = $id;
        $pdo->prepare('UPDATE gate_options SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
    }
    $stmt = $pdo->prepare('SELECT * FROM gate_options WHERE id = ?');
    $stmt->execute([$id]);
    ok(mapOptionRow($stmt->fetch()));
}

if ($method === 'DELETE' && $id && ($action === 'option')) {
    requireAuth();
    $pdo->prepare('DELETE FROM gate_options WHERE id = ?')->execute([$id]);
    ok();
}

// ── Client actions (no admin auth needed) ───────────────────

// Approve a gate
if ($method === 'POST' && $id && ($action === 'approve')) {
    $data = body();
    $approvedBy = $data['approvedBy'] ?? 'Client';

    // Verify gate is open
    $stmt = $pdo->prepare('SELECT * FROM funnel_gates WHERE id = ?');
    $stmt->execute([$id]);
    $gate = $stmt->fetch();
    if (!$gate) fail('Gate not found', 404);
    if ($gate['status'] !== 'open') fail('Gate is not open for approval');

    // If choice gate, ensure an option is selected
    if ($gate['gate_type'] === 'choice') {
        $stmt = $pdo->prepare('SELECT COUNT(*) as c FROM gate_options WHERE gate_id = ? AND is_selected = 1');
        $stmt->execute([$id]);
        if ((int)$stmt->fetch()['c'] === 0) fail('Select an option before approving');
    }

    $pdo->prepare('UPDATE funnel_gates SET status = ?, approved_at = NOW(), approved_by = ? WHERE id = ?')
        ->execute(['approved', $approvedBy, $id]);

    // Notification: gate approved
    try {
        $stmt = $pdo->prepare('
            SELECT pf.project_id, p.title as project_title
            FROM funnel_phases fp
            JOIN project_funnels pf ON fp.funnel_id = pf.id
            JOIN projects p ON pf.project_id = p.id
            WHERE fp.id = ?
        ');
        $stmt->execute([$gate['phase_id']]);
        $proj = $stmt->fetch();
        if ($proj) {
            $pdo->prepare('INSERT INTO notifications (id, project_id, project_title, task_title, client_name, question, response) VALUES (?,?,?,?,?,?,?)')
                ->execute([uuid(), $proj['project_id'], $proj['project_title'], 'Porte validée', $approvedBy, $gate['title'], 'approved']);
        }
    } catch (Exception $e) {}

    // Auto-open next gate in the phase
    $stmt = $pdo->prepare('SELECT id FROM funnel_gates WHERE phase_id = ? AND gate_order > ? AND status = ? ORDER BY gate_order LIMIT 1');
    $stmt->execute([$gate['phase_id'], $gate['gate_order'], 'locked']);
    $next = $stmt->fetch();
    if ($next) {
        $pdo->prepare('UPDATE funnel_gates SET status = ? WHERE id = ?')->execute(['open', $next['id']]);
        notifyGateOpen($pdo, $next['id']);
    }

    ok(['approved' => true, 'nextGateId' => $next['id'] ?? null]);
}

// Select an option (client picks)
if ($method === 'POST' && $id && ($action === 'select')) {
    $data = body();
    $optionId = $data['optionId'] ?? '';
    if (!$optionId) fail('optionId required');

    // Verify gate is open
    $stmt = $pdo->prepare('SELECT * FROM funnel_gates WHERE id = ?');
    $stmt->execute([$id]);
    $gate = $stmt->fetch();
    if (!$gate) fail('Gate not found', 404);
    if ($gate['status'] !== 'open') fail('Gate is not open');

    // Deselect all, select chosen
    $pdo->prepare('UPDATE gate_options SET is_selected = 0 WHERE gate_id = ?')->execute([$id]);
    $pdo->prepare('UPDATE gate_options SET is_selected = 1 WHERE id = ? AND gate_id = ?')->execute([$optionId, $id]);

    ok(['selected' => $optionId]);
}

// Request revision (client sends back with feedback)
if ($method === 'POST' && $id && ($action === 'revision')) {
    $data = body();

    $stmt = $pdo->prepare('SELECT * FROM funnel_gates WHERE id = ?');
    $stmt->execute([$id]);
    $gate = $stmt->fetch();
    if (!$gate) fail('Gate not found', 404);
    if ($gate['status'] !== 'open') fail('Gate is not open');

    $newCount = (int)$gate['revision_count'] + 1;
    $pdo->prepare('UPDATE funnel_gates SET status = ?, revision_count = ? WHERE id = ?')
        ->execute(['revision', $newCount, $id]);

    // Notification: revision requested
    try {
        $stmt = $pdo->prepare('
            SELECT pf.project_id, p.title as project_title
            FROM funnel_phases fp
            JOIN project_funnels pf ON fp.funnel_id = pf.id
            JOIN projects p ON pf.project_id = p.id
            WHERE fp.id = ?
        ');
        $stmt->execute([$gate['phase_id']]);
        $proj = $stmt->fetch();
        if ($proj) {
            $pdo->prepare('INSERT INTO notifications (id, project_id, project_title, task_title, client_name, question, response) VALUES (?,?,?,?,?,?,?)')
                ->execute([uuid(), $proj['project_id'], $proj['project_title'], 'Révision demandée', $data['authorName'] ?? 'Client', $gate['title'], 'revision']);
        }
    } catch (Exception $e) {}

    // Add the revision comment
    if (!empty($data['message'])) {
        $cId = uuid();
        $pdo->prepare('INSERT INTO gate_comments (id, gate_id, author_name, author_email, author_role, message) VALUES (?,?,?,?,?,?)')
            ->execute([$cId, $id, $data['authorName'] ?? 'Client', $data['authorEmail'] ?? '', 'client', $data['message']]);
    }

    ok(['revisionCount' => $newCount, 'overLimit' => $newCount > (int)$gate['revision_limit']]);
}

// Add comment (client or stakeholder)
if ($method === 'POST' && $id && ($action === 'comment')) {
    $data = body();
    if (empty($data['message'])) fail('message required');

    $cId = uuid();
    $pdo->prepare('INSERT INTO gate_comments (id, gate_id, author_name, author_email, author_role, message) VALUES (?,?,?,?,?,?)')
        ->execute([$cId, $id, $data['authorName'] ?? '', $data['authorEmail'] ?? '', $data['authorRole'] ?? 'client', $data['message']]);

    $stmt = $pdo->prepare('SELECT * FROM gate_comments WHERE id = ?');
    $stmt->execute([$cId]);
    ok(mapCommentRow($stmt->fetch()));
}

// ── Row mappers (flat, no nesting) ──────────────────────────

function mapPhaseRow(array $r): array {
    return [
        'id' => $r['id'], 'funnelId' => $r['funnel_id'], 'title' => $r['title'],
        'description' => $r['description'] ?? '', 'phaseOrder' => (int)$r['phase_order'],
        'budget' => $r['budget'] !== null ? (float)$r['budget'] : null,
        'status' => $r['status'], 'startedAt' => $r['started_at'] ?? null,
        'completedAt' => $r['completed_at'] ?? null,
    ];
}

function mapGateRow(array $r): array {
    return [
        'id' => $r['id'], 'phaseId' => $r['phase_id'], 'title' => $r['title'],
        'description' => $r['description'] ?? '', 'gateType' => $r['gate_type'],
        'gateOrder' => (int)$r['gate_order'], 'status' => $r['status'],
        'deadline' => $r['deadline'] ?? null, 'revisionLimit' => (int)$r['revision_limit'],
        'revisionCount' => (int)$r['revision_count'], 'approvedAt' => $r['approved_at'] ?? null,
        'approvedBy' => $r['approved_by'] ?? null,
    ];
}

function mapOptionRow(array $r): array {
    $images = json_decode($r['images_json'] ?? 'null', true);
    if (!$images && !empty($r['image_url'])) $images = [$r['image_url']];
    return [
        'id' => $r['id'], 'gateId' => $r['gate_id'], 'title' => $r['title'] ?? '',
        'description' => $r['description'] ?? '', 'imageUrl' => $r['image_url'] ?? null,
        'images' => $images ?: [],
        'linkUrl' => $r['link_url'] ?? null, 'isRecommended' => (bool)$r['is_recommended'],
        'isSelected' => (bool)$r['is_selected'], 'optionOrder' => (int)$r['option_order'],
    ];
}

function mapCommentRow(array $r): array {
    return [
        'id' => $r['id'], 'gateId' => $r['gate_id'], 'authorName' => $r['author_name'] ?? '',
        'authorEmail' => $r['author_email'] ?? '', 'authorRole' => $r['author_role'],
        'message' => $r['message'], 'createdAt' => $r['created_at'],
    ];
}

fail('Invalid request', 400);
