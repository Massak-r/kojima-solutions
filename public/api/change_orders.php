<?php
require_once __DIR__ . '/_bootstrap.php';
requireAuthForWrites();

function mapCO(array $r): array {
    return [
        'id'             => $r['id'],
        'funnelId'       => $r['funnel_id'],
        'gateId'         => $r['gate_id'] ?? null,
        'quoteId'        => $r['quote_id'] ?? null,
        'title'          => $r['title'],
        'description'    => $r['description'] ?? '',
        'costImpact'     => $r['cost_impact'] !== null ? (float)$r['cost_impact'] : null,
        'timeImpactDays' => $r['time_impact_days'] !== null ? (int)$r['time_impact_days'] : null,
        'status'         => $r['status'],
        'createdAt'      => $r['created_at'],
        'resolvedAt'     => $r['resolved_at'] ?? null,
    ];
}

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;
$funnelId = $_GET['funnel_id'] ?? null;

// GET — list by funnel
if ($method === 'GET' && $funnelId) {
    $stmt = $pdo->prepare('SELECT * FROM change_orders WHERE funnel_id = ? ORDER BY created_at DESC');
    $stmt->execute([$funnelId]);
    ok(array_map('mapCO', $stmt->fetchAll()));
}

// GET — single
if ($method === 'GET' && $id) {
    $stmt = $pdo->prepare('SELECT * FROM change_orders WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) fail('Not found', 404);
    ok(mapCO($row));
}

// POST — create
if ($method === 'POST') {
    $data = body();
    if (empty($data['funnelId'])) fail('funnelId required');
    if (empty($data['title'])) fail('title required');

    $coId = uuid();
    $stmt = $pdo->prepare('INSERT INTO change_orders (id, funnel_id, gate_id, quote_id, title, description, cost_impact, time_impact_days, status) VALUES (?,?,?,?,?,?,?,?,?)');
    $stmt->execute([
        $coId,
        $data['funnelId'],
        $data['gateId'] ?? null,
        $data['quoteId'] ?? null,
        $data['title'],
        $data['description'] ?? '',
        $data['costImpact'] ?? null,
        $data['timeImpactDays'] ?? null,
        $data['status'] ?? 'proposed',
    ]);

    $stmt = $pdo->prepare('SELECT * FROM change_orders WHERE id = ?');
    $stmt->execute([$coId]);
    ok(mapCO($stmt->fetch()));
}

// PUT — update (accept/reject)
if ($method === 'PUT' && $id) {
    $data = body();
    $sets = [];
    $vals = [];
    foreach (['title' => 'title', 'description' => 'description', 'costImpact' => 'cost_impact', 'timeImpactDays' => 'time_impact_days', 'status' => 'status', 'quoteId' => 'quote_id'] as $js => $col) {
        if (array_key_exists($js, $data)) {
            $sets[] = "$col = ?";
            $vals[] = $data[$js];
        }
    }
    if (in_array($data['status'] ?? '', ['accepted', 'rejected'])) {
        $sets[] = 'resolved_at = NOW()';
    }
    if ($sets) {
        $vals[] = $id;
        $pdo->prepare('UPDATE change_orders SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
    }

    $stmt = $pdo->prepare('SELECT * FROM change_orders WHERE id = ?');
    $stmt->execute([$id]);
    ok(mapCO($stmt->fetch()));
}

// DELETE
if ($method === 'DELETE' && $id) {
    $pdo->prepare('DELETE FROM change_orders WHERE id = ?')->execute([$id]);
    ok();
}

fail('Invalid request', 400);
