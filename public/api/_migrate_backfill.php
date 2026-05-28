<?php
// One-shot: backfill the migrations table for files that pre-date a cutoff.
// Use case: an earlier migration genuinely failed but its DDL was already
// applied through self-healing app code, so it can't be re-run cleanly.
// Marks them applied (INSERT IGNORE) so the regular runner can proceed.
//
// Trigger: POST /api/_migrate_backfill.php?before=YYYYMMDDHHMMSS
// Auth: admin session OR X-API-Key.

require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('POST only', 405);

$before = $_GET['before'] ?? '';
if (!preg_match('/^\d{14}$/', $before)) fail('Missing or invalid ?before=YYYYMMDDHHMMSS', 400);

$migrationsDir = realpath(__DIR__ . '/../database/migrations');
if (!$migrationsDir || !is_dir($migrationsDir)) fail('Migrations directory not found', 500);

$pdo->exec("
    CREATE TABLE IF NOT EXISTS migrations (
        filename   VARCHAR(255) PRIMARY KEY,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

$files = glob($migrationsDir . '/*.sql') ?: [];
sort($files);

$marked = [];
$skipped = [];
$stmt = $pdo->prepare('INSERT IGNORE INTO migrations (filename) VALUES (?)');
foreach ($files as $path) {
    $filename = basename($path);
    if (!preg_match('/^(\d{14})_/', $filename, $m)) continue;
    if ($m[1] < $before) {
        $stmt->execute([$filename]);
        $marked[] = $filename;
    } else {
        $skipped[] = $filename;
    }
}

ok(['marked' => $marked, 'skipped_newer' => $skipped]);
