<?php
// Phase 2b — Generate a structured project brief from a client intake submission.
// Calls Claude AI, returns markdown brief, and saves it as a note on the linked
// objective if intake.project_id is set and a matching objective exists.
// POST /api/auto/generate_brief.php  body: {intakeId: "uuid"}
require_once __DIR__ . '/../_bootstrap.php';
requireAuth();

if (!defined('ANTHROPIC_API_KEY') || !ANTHROPIC_API_KEY) {
    fail('ANTHROPIC_API_KEY not configured in config.php', 503);
}

$data     = body();
$intakeId = $data['intakeId'] ?? $_GET['intake_id'] ?? null;
if (!$intakeId) fail('intakeId required');

$stmt = $pdo->prepare('SELECT * FROM intake_responses WHERE id = ?');
$stmt->execute([$intakeId]);
$intake = $stmt->fetch();
if (!$intake) fail('Intake not found', 404);

$responses   = $intake['responses_json'] ? json_decode($intake['responses_json'], true) : [];
$projectType = $responses['projectType'] ?? 'Non spécifié';
$goals       = is_array($responses['goals'] ?? null)
    ? implode(', ', $responses['goals'])
    : ($responses['goals'] ?? '');
$timeline    = $responses['timeline'] ?? 'Non spécifié';
$budget      = $responses['budget'] ?? 'Non spécifié';
$details     = $responses['details'] ?? '';
$clientName  = $intake['client_name'] ?? 'Client';
$clientEmail = $intake['client_email'] ?? '';

$context = "Client: $clientName" . ($clientEmail ? " <$clientEmail>" : "") . "\n" .
           "Type de projet: $projectType\n" .
           "Objectifs: $goals\n" .
           "Délai: $timeline\n" .
           "Budget: $budget\n" .
           ($details ? "Détails: $details\n" : "") .
           "Forfait suggéré: " . ($intake['suggested_tier'] ?? 'Non spécifié');

$prompt = "Sur la base de ce formulaire d'intake client, génère un brief de projet structuré en markdown (en français).\n\n" .
          "Inclure:\n" .
          "1. **Contexte** — qui est le client, quel problème il veut résoudre\n" .
          "2. **Objectifs** — ce que le projet doit accomplir\n" .
          "3. **Périmètre proposé** — fonctionnalités clés à développer\n" .
          "4. **Points à clarifier** — questions à poser au client\n" .
          "5. **Recommandation** — approche technique et forfait suggéré\n\n" .
          "Formulaire intake:\n$context";

$payload = json_encode([
    'model'      => 'claude-haiku-4-5-20251001',
    'max_tokens' => 1024,
    'messages'   => [['role' => 'user', 'content' => $prompt]],
]);

$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'x-api-key: ' . ANTHROPIC_API_KEY,
        'anthropic-version: 2023-06-01',
    ],
    CURLOPT_POSTFIELDS => $payload,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200 || !$response) {
    fail('Anthropic API error: ' . substr($response ?: '', 0, 200), 502);
}

$apiResult = json_decode($response, true);
$brief     = $apiResult['content'][0]['text'] ?? '';
if (!$brief) fail('Empty response from Anthropic', 502);

// Save as note on the linked objective if intake is tied to a project
$noteSaved = false;
$noteId    = null;
if (!empty($intake['project_id'])) {
    $objStmt = $pdo->prepare(
        "SELECT id FROM admin_todos WHERE linked_project_id = ? LIMIT 1"
    );
    $objStmt->execute([$intake['project_id']]);
    $linkedObj = $objStmt->fetch();

    if ($linkedObj) {
        $nId = uuid();
        $pdo->prepare(
            'INSERT INTO objective_notes (id, source, objective_id, title, content, pinned, created_at, updated_at)
             VALUES (?,?,?,?,?,0,NOW(),NOW())'
        )->execute([$nId, 'admin', $linkedObj['id'], "Brief client — $clientName", $brief]);
        $noteSaved = true;
        $noteId    = $nId;
    }
}

ok([
    'brief'     => $brief,
    'noteSaved' => $noteSaved,
    'noteId'    => $noteId,
    'intakeId'  => $intakeId,
]);
