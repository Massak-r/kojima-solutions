<?php
require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

// GET ?slug=<slug>  →  { slug, exists, content, mtime }
//
// Reads `.kojima-journal/projects/<slug>.md` from the deploy. The journals are
// local-first text files (edited offline with any editor) and synced to the
// server by deploy.sh so the in-app widget can render them. Strict slug
// validation prevents path traversal — only [a-z0-9-_] allowed.

if ($_SERVER['REQUEST_METHOD'] !== 'GET') fail('Method not allowed', 405);

$slug = $_GET['slug'] ?? '';
if (!preg_match('/^[a-z0-9\-_]{1,80}$/', $slug)) {
    fail('slug must match [a-z0-9-_]{1,80}');
}

// Server layout after deploy.sh: REMOTE_PATH/.kojima-journal/projects/<slug>.md
// PHP file lives at REMOTE_PATH/api/project_journal.php → climb one level.
$path = __DIR__ . '/../.kojima-journal/projects/' . $slug . '.md';

if (!file_exists($path)) {
    ok(['slug' => $slug, 'exists' => false, 'content' => '', 'mtime' => null]);
}

$content = @file_get_contents($path);
$mtime   = @filemtime($path);
if ($content === false) fail('Cannot read journal', 500);

ok([
    'slug'    => $slug,
    'exists'  => true,
    'content' => $content,
    'mtime'   => $mtime ? date('c', $mtime) : null,
]);
