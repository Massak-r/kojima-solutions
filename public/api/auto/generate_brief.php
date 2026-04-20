<?php
// Phase 2b — Return structured intake data so Claude (MCP) can generate a brief.
// Claude reads the output, writes the brief, then calls create_note to save it.
// GET /api/auto/generate_brief.php?intake_id=uuid
require_once __DIR__ . '/../_bootstrap.php';
requireAuth();

$intakeId = $_GET['intake_id'] ?? (body()['intakeId'] ?? null);
if (!$intakeId) fail('intake_id required');

$stmt = $pdo->prepare('SELECT * FROM intake_responses WHERE id = ?');
$stmt->execute([$intakeId]);
$intake = $stmt->fetch();
if (!$intake) fail('Intake not found', 404);

$responses = $intake['responses_json'] ? json_decode($intake['responses_json'], true) : [];

// If intake is linked to a project, find the linked objective so Claude knows
// which objective_id + source to pass to create_note.
$linkedObjective = null;
if (!empty($intake['project_id'])) {
    $objStmt = $pdo->prepare(
        "SELECT id, text FROM admin_todos WHERE linked_project_id = ? LIMIT 1"
    );
    $objStmt->execute([$intake['project_id']]);
    $obj = $objStmt->fetch();
    if ($obj) {
        $linkedObjective = ['id' => $obj['id'], 'source' => 'admin', 'text' => $obj['text']];
    }
}

ok([
    'intakeId'       => $intake['id'],
    'clientName'     => $intake['client_name'],
    'clientEmail'    => $intake['client_email'],
    'responses'      => $responses,
    'suggestedTier'  => $intake['suggested_tier'],
    'status'         => $intake['status'],
    'createdAt'      => $intake['created_at'],
    'linkedObjective' => $linkedObjective,
]);
