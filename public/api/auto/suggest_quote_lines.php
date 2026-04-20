<?php
// Phase 2c — Suggest invoice line items from tracked focus sessions.
// Reads all completed sessions for objectives linked to a project, groups by
// objective, asks Claude to propose quote lines, and returns them as JSON.
// GET /api/auto/suggest_quote_lines.php?project_id=uuid
require_once __DIR__ . '/../_bootstrap.php';
requireAuth();

if (!defined('ANTHROPIC_API_KEY') || !ANTHROPIC_API_KEY) {
    fail('ANTHROPIC_API_KEY not configured in config.php', 503);
}

$projectId = $_GET['project_id'] ?? (body()['projectId'] ?? null);
if (!$projectId) fail('project_id required');

$projStmt = $pdo->prepare('SELECT * FROM projects WHERE id = ?');
$projStmt->execute([$projectId]);
$project = $projStmt->fetch();
if (!$project) fail('Project not found', 404);

// Objectives linked to this project
$objStmt = $pdo->prepare('SELECT id, text FROM admin_todos WHERE linked_project_id = ?');
$objStmt->execute([$projectId]);
$objectives = $objStmt->fetchAll();

if (empty($objectives)) {
    ok(['lines' => [], 'totalHours' => 0, 'message' => 'No objectives linked to this project.']);
}

// All completed sessions for those objectives
$objIds       = array_column($objectives, 'id');
$placeholders = implode(',', array_fill(0, count($objIds), '?'));
$sessStmt     = $pdo->prepare(
    "SELECT s.objective_id, s.duration_sec, t.text AS objective_text
     FROM objective_sessions s
     JOIN admin_todos t ON s.objective_id = t.id
     WHERE s.objective_id IN ($placeholders)
       AND s.source = 'admin'
       AND s.ended_at IS NOT NULL
       AND s.duration_sec IS NOT NULL"
);
$sessStmt->execute($objIds);
$sessions = $sessStmt->fetchAll();

if (empty($sessions)) {
    ok(['lines' => [], 'totalHours' => 0, 'message' => 'No completed focus sessions found for this project.']);
}

// Aggregate by objective
$byObj = [];
foreach ($sessions as $s) {
    $oid = $s['objective_id'];
    if (!isset($byObj[$oid])) {
        $byObj[$oid] = ['text' => $s['objective_text'], 'totalSec' => 0, 'sessions' => 0];
    }
    $byObj[$oid]['totalSec']  += (int)$s['duration_sec'];
    $byObj[$oid]['sessions']++;
}

$totalSec   = array_sum(array_column($byObj, 'totalSec'));
$totalHours = round($totalSec / 3600, 2);

$sessionSummary = "Projet: {$project['title']}\nTravail tracé:\n";
foreach ($byObj as $o) {
    $h = round($o['totalSec'] / 3600, 2);
    $sessionSummary .= "- {$o['text']}: {$h}h ({$o['sessions']} session" . ($o['sessions'] > 1 ? 's' : '') . ")\n";
}
$sessionSummary .= "\nTotal: {$totalHours}h";

$prompt = "Sur la base de ces sessions de travail tracées, propose des lignes de facturation.\n\n" .
          "Réponds UNIQUEMENT avec un tableau JSON (sans markdown):\n" .
          "[{\"description\": \"...\", \"quantity\": heures_arrondies_au_demi, \"unitPrice\": 100}]\n\n" .
          "Règles:\n" .
          "- Regroupe les tâches similaires si pertinent\n" .
          "- Arrondi les heures au 0.5h supérieur\n" .
          "- Tarif fixe: 100 CHF/h\n" .
          "- Descriptions professionnelles, claires\n\n" .
          $sessionSummary;

$payload = json_encode([
    'model'      => 'claude-haiku-4-5-20251001',
    'max_tokens' => 512,
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
$raw       = $apiResult['content'][0]['text'] ?? '';
$raw       = preg_replace('/^```(?:json)?\s*|\s*```$/s', '', trim($raw));
$lines     = json_decode($raw, true);

if (!is_array($lines)) {
    fail('Could not parse AI suggestion: ' . $raw, 502);
}

ok([
    'lines'      => $lines,
    'totalHours' => $totalHours,
    'breakdown'  => array_values($byObj),
    'projectId'  => $projectId,
]);
