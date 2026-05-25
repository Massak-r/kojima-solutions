<?php
// Phase 2c — Return aggregated focus session data so Claude (MCP) can suggest
// invoice lines. Claude reads the breakdown, proposes lines, then calls
// create_quote if the user approves.
// GET /api/auto/suggest_quote_lines.php?project_id=uuid
require_once __DIR__ . '/../_bootstrap.php';
requireAdminSession();

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

// Multi-subtask attribution: a single session can credit several subtasks
// (each potentially under a different objective/project). When that happens
// we split duration_sec equally across the pivot rows. Sessions with no
// pivot row (legacy) keep the old behaviour: full duration → their bound
// objective. The UNION ALL keeps both branches in one pass.
// Skip sessions already attached to an invoice — they shouldn't reappear in
// the suggest pipeline. The frontend imports lines and POSTs mark_billed in
// the same transaction, so unbilled = available, billed = locked.
$sessStmt = $pdo->prepare(
    "SELECT
        parent.id   AS objective_id,
        parent.text AS objective_text,
        st.id       AS subtask_id,
        st.text     AS subtask_text,
        s.id        AS session_id,
        s.duration_sec / cnt.n AS attributed_sec
     FROM objective_session_subtasks pivot
     JOIN objective_sessions s ON s.id = pivot.session_id
     JOIN todo_subtasks st     ON st.id = pivot.subtask_id
     JOIN admin_todos parent   ON parent.id = st.parent_id
     JOIN (
         SELECT session_id, COUNT(*) AS n
         FROM objective_session_subtasks
         GROUP BY session_id
     ) cnt ON cnt.session_id = pivot.session_id
     WHERE parent.linked_project_id = :pid
       AND st.source = 'admin'
       AND s.source = 'admin'
       AND s.ended_at IS NOT NULL
       AND s.duration_sec IS NOT NULL
       AND s.billed_at IS NULL

     UNION ALL

     SELECT
        parent.id   AS objective_id,
        parent.text AS objective_text,
        NULL        AS subtask_id,
        NULL        AS subtask_text,
        s.id        AS session_id,
        s.duration_sec AS attributed_sec
     FROM objective_sessions s
     JOIN admin_todos parent ON parent.id = s.objective_id
     WHERE parent.linked_project_id = :pid2
       AND s.source = 'admin'
       AND s.ended_at IS NOT NULL
       AND s.duration_sec IS NOT NULL
       AND s.billed_at IS NULL
       AND s.id NOT IN (SELECT session_id FROM objective_session_subtasks)"
);
$sessStmt->execute(['pid' => $projectId, 'pid2' => $projectId]);
$rows = $sessStmt->fetchAll();

// Aggregate: objective → { totalSec, distinct sessions, subtasks → { totalSec, distinct sessions } }
$byObj = [];
foreach ($rows as $r) {
    $oid = $r['objective_id'];
    if (!isset($byObj[$oid])) {
        $byObj[$oid] = [
            'text'      => $r['objective_text'],
            'totalSec'  => 0.0,
            'sessions'  => [],
            'subtasks'  => [],
        ];
    }
    $byObj[$oid]['totalSec']        += (float)$r['attributed_sec'];
    $byObj[$oid]['sessions'][$r['session_id']] = true;
    if ($r['subtask_id']) {
        $stid = $r['subtask_id'];
        if (!isset($byObj[$oid]['subtasks'][$stid])) {
            $byObj[$oid]['subtasks'][$stid] = [
                'text'     => $r['subtask_text'],
                'totalSec' => 0.0,
                'sessions' => [],
            ];
        }
        $byObj[$oid]['subtasks'][$stid]['totalSec']  += (float)$r['attributed_sec'];
        $byObj[$oid]['subtasks'][$stid]['sessions'][$r['session_id']] = true;
    }
}

$totalSec   = 0.0;
foreach ($byObj as $o) $totalSec += $o['totalSec'];
$totalHours = round($totalSec / 3600, 2);

ok([
    'projectId'    => $projectId,
    'projectTitle' => $project['title'],
    'clientId'     => $project['client_id'] ?? null,
    'totalHours'   => $totalHours,
    // sessionIds is exposed at every level so the frontend knows exactly
    // which rows to mark_billed when the user accepts a subset of lines.
    'breakdown'    => array_values(array_map(function ($o) {
        return [
            'objective'  => $o['text'],
            'hours'      => round($o['totalSec'] / 3600, 2),
            'sessions'   => count($o['sessions']),
            'sessionIds' => array_keys($o['sessions']),
            'subtasks'   => array_values(array_map(function ($st) {
                return [
                    'subtask'    => $st['text'],
                    'hours'      => round($st['totalSec'] / 3600, 2),
                    'sessions'   => count($st['sessions']),
                    'sessionIds' => array_keys($st['sessions']),
                ];
            }, $o['subtasks'])),
        ];
    }, $byObj)),
]);
