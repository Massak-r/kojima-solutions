<?php
// Temporary migration: add SMART objective columns + subtasks table
// Deploy → hit via HTTP → delete from server
require_once __DIR__ . '/config.php';

$pdo = new PDO(
    'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
    DB_USER, DB_PASS,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);

$results = [];

// 0. Create admin_todos table if it doesn't exist
try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS admin_todos (
            id          VARCHAR(36)   NOT NULL,
            text        TEXT          NOT NULL,
            completed   TINYINT(1)    NOT NULL DEFAULT 0,
            category    VARCHAR(100)  NOT NULL DEFAULT 'Général',
            due_date    DATE          NULL,
            sort_order  INT           NOT NULL DEFAULT 0,
            created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_completed (completed)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    $results[] = 'admin_todos table ensured';
} catch (PDOException $e) {
    $results[] = 'admin_todos create: ' . $e->getMessage();
}

// 1. Add is_objective + description to personal_todos
try {
    $pdo->exec('ALTER TABLE personal_todos ADD COLUMN is_objective TINYINT(1) NOT NULL DEFAULT 0');
    $results[] = 'personal_todos.is_objective added';
} catch (PDOException $e) {
    $results[] = 'personal_todos.is_objective: ' . $e->getMessage();
}
try {
    $pdo->exec('ALTER TABLE personal_todos ADD COLUMN description TEXT DEFAULT NULL');
    $results[] = 'personal_todos.description added';
} catch (PDOException $e) {
    $results[] = 'personal_todos.description: ' . $e->getMessage();
}

// 2. Add is_objective + description to admin_todos
try {
    $pdo->exec('ALTER TABLE admin_todos ADD COLUMN is_objective TINYINT(1) NOT NULL DEFAULT 0');
    $results[] = 'admin_todos.is_objective added';
} catch (PDOException $e) {
    $results[] = 'admin_todos.is_objective: ' . $e->getMessage();
}
try {
    $pdo->exec('ALTER TABLE admin_todos ADD COLUMN description TEXT DEFAULT NULL');
    $results[] = 'admin_todos.description added';
} catch (PDOException $e) {
    $results[] = 'admin_todos.description: ' . $e->getMessage();
}

// 3. Create todo_subtasks table
try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS todo_subtasks (
            id          VARCHAR(36)  NOT NULL PRIMARY KEY,
            source      ENUM('personal','admin') NOT NULL,
            parent_id   VARCHAR(36)  NOT NULL,
            text        VARCHAR(500) NOT NULL,
            completed   TINYINT(1)   NOT NULL DEFAULT 0,
            due_date    DATE         DEFAULT NULL,
            sort_order  INT          NOT NULL DEFAULT 0,
            created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_parent (source, parent_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    $results[] = 'todo_subtasks table created';
} catch (PDOException $e) {
    $results[] = 'todo_subtasks: ' . $e->getMessage();
}

header('Content-Type: application/json');
echo json_encode(['results' => $results], JSON_PRETTY_PRINT);
