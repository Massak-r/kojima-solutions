<?php
require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

// GET ?source=admin|personal&since=YYYY-MM-DD
// Returns: { [subtaskId]: ["YYYY-MM-DD", ...] }
//
// Powers the "recurrence streak" UI in SubtaskCard. Returned dates are
// pre-distilled to the day (DATE(completed_at)), in DESC order so the most
// recent completion is first per subtask.

if ($_SERVER['REQUEST_METHOD'] !== 'GET') fail('Method not allowed', 405);

$source = $_GET['source'] ?? null;
$since  = $_GET['since']  ?? null;

if (!in_array($source, ['admin', 'personal'], true)) fail('source must be admin or personal');
if (!$since || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $since))   fail('since must be YYYY-MM-DD');
if ($since > date('Y-m-d'))                                    fail('since must not be in the future');

try {
    $stmt = $pdo->prepare("
        SELECT subtask_id, DATE(completed_at) AS d
        FROM subtask_completion_log
        WHERE source = ? AND completed_at >= ?
        ORDER BY completed_at DESC
    ");
    $stmt->execute([$source, $since . ' 00:00:00']);
    $rows = $stmt->fetchAll();
} catch (Throwable $e) {
    // Table may not exist yet on the very first deploy — treat as empty rather
    // than 500ing the SubtaskCard fetch.
    ok([]);
}

$out = [];
foreach ($rows as $r) {
    $sid = $r['subtask_id'];
    if (!isset($out[$sid])) $out[$sid] = [];
    $out[$sid][] = $r['d'];
}
ok((object)$out);
