<?php
// Phase 2c — Return aggregated focus session data so Claude (MCP) can suggest
// invoice lines. Claude reads the breakdown, proposes lines, then calls
// create_quote if the user approves.
// GET /api/auto/suggest_quote_lines.php?project_id=uuid
require_once __DIR__ . '/../_bootstrap.php';
requireAuth();

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
    ok(['breakdown' => [], 'totalHours' => 0, 'projectTitle' => $project['title'],
        'message' => 'No objectives linked to this project.']);
}

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

ok([
    'projectId'    => $projectId,
    'projectTitle' => $project['title'],
    'clientId'     => $project['client_id'] ?? null,
    'totalHours'   => $totalHours,
    'breakdown'    => array_values(array_map(function ($o) {
        return [
            'objective' => $o['text'],
            'hours'     => round($o['totalSec'] / 3600, 2),
            'sessions'  => $o['sessions'],
        ];
    }, $byObj)),
]);
