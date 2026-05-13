<?php
require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

// GET → { pendingLines, totalLines, mtime }
//
// Quick stats on .kojima-journal/inbox.md so the Monday brief popup can show
// "X captures en attente" without parsing the full file client-side. A
// "pending" line starts with "- [ ]" and is NOT wrapped in "~~...~~" (those
// are already filed via /triage).

if ($_SERVER['REQUEST_METHOD'] !== 'GET') fail('Method not allowed', 405);

$path = __DIR__ . '/../.kojima-journal/inbox.md';
if (!file_exists($path)) {
    ok(['pendingLines' => 0, 'totalLines' => 0, 'mtime' => null]);
}

$content = @file_get_contents($path);
if ($content === false) fail('Cannot read inbox', 500);

$pendingLines = 0;
$totalLines   = 0;
foreach (preg_split('/\r?\n/', $content) as $line) {
    if (preg_match('/^\s*-\s*\[\s*\]\s*/', $line)) {
        $totalLines++;
        // strike-through tilde wrap means already triaged
        if (!preg_match('/~~.*~~/', $line)) {
            $pendingLines++;
        }
    }
}

$mtime = @filemtime($path);
ok([
    'pendingLines' => $pendingLines,
    'totalLines'   => $totalLines,
    'mtime'        => $mtime ? date('c', $mtime) : null,
]);
