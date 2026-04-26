<?php
// Admin-only migration runner. Applies any *.sql files in
// database/migrations/ that haven't been recorded in the `migrations` table
// yet, in lexical order. Each file runs inside a transaction; the first
// failure stops the run and rolls back that file.
//
// Trigger: POST /api/db_migrate.php (admin session required).
// See database/migrations/README.md for the full workflow.

require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('POST only', 405);

// On prod the layout is ${REMOTE_PATH}/api/ + ${REMOTE_PATH}/database/migrations/
// (deploy.sh syncs the migrations dir alongside the dist output). One `..`
// from __DIR__ is correct for that flat layout.
$migrationsDir = realpath(__DIR__ . '/../database/migrations');
if (!$migrationsDir || !is_dir($migrationsDir)) {
    fail('Migrations directory not found at database/migrations/', 500);
}

// Tracking table — created on first run.
$pdo->exec("
    CREATE TABLE IF NOT EXISTS migrations (
        filename   VARCHAR(255) PRIMARY KEY,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

$applied = [];
foreach ($pdo->query('SELECT filename FROM migrations') as $row) {
    $applied[$row['filename']] = true;
}

$files = glob($migrationsDir . '/*.sql') ?: [];
sort($files);

$results = [];

foreach ($files as $path) {
    $filename = basename($path);
    if (isset($applied[$filename])) {
        $results[] = ['file' => $filename, 'status' => 'skipped'];
        continue;
    }

    $sql = file_get_contents($path);
    if ($sql === false) {
        $results[] = ['file' => $filename, 'status' => 'error', 'error' => 'could not read file'];
        break;
    }

    // Strip line comments so they don't confuse the splitter, then split on
    // ";\n" boundaries. Migrations should keep each statement on its own
    // line; embedded ";\n" inside string literals will trip this.
    $cleanSql = preg_replace('/^\s*--.*$/m', '', $sql);
    $statements = array_filter(array_map('trim', preg_split('/;\s*\n/', $cleanSql)));

    try {
        $pdo->beginTransaction();
        foreach ($statements as $stmt) {
            if ($stmt === '') continue;
            $pdo->exec($stmt);
        }
        $pdo->prepare('INSERT INTO migrations (filename) VALUES (?)')->execute([$filename]);
        $pdo->commit();
        $results[] = ['file' => $filename, 'status' => 'applied'];
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        $results[] = ['file' => $filename, 'status' => 'error', 'error' => $e->getMessage()];
        break;
    }
}

ok(['migrations' => $results]);
