<?php
/**
 * One-shot migration script: unify todos into admin_todos table + create personal_docs
 * Run via: curl https://kojima-solutions.ch/api/migrate_unified.php
 * Then DELETE this file from server.
 */
require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();
header('Content-Type: text/plain');

$steps = [];

// 1. Add recurring column to admin_todos if missing
try {
    $cols = $pdo->query("SHOW COLUMNS FROM admin_todos LIKE 'recurring'")->fetchAll();
    if (empty($cols)) {
        $pdo->exec("ALTER TABLE admin_todos ADD COLUMN recurring VARCHAR(10) DEFAULT NULL AFTER due_date");
        $steps[] = "Added 'recurring' column to admin_todos";
    } else {
        $steps[] = "'recurring' column already exists in admin_todos";
    }
} catch (Exception $e) {
    $steps[] = "ERROR adding recurring: " . $e->getMessage();
}

// 2. Migrate personal_todos into admin_todos
try {
    $exists = $pdo->query("SHOW TABLES LIKE 'personal_todos'")->fetch();
    if ($exists) {
        $count = (int)$pdo->query("SELECT COUNT(*) FROM personal_todos")->fetchColumn();
        if ($count > 0) {
            // Check if already migrated (look for category='Perso' items matching personal_todos ids)
            $alreadyMigrated = (int)$pdo->query("SELECT COUNT(*) FROM admin_todos WHERE category = 'Perso'")->fetchColumn();
            if ($alreadyMigrated === 0) {
                $pdo->exec("
                    INSERT INTO admin_todos (id, text, completed, category, due_date, recurring, sort_order, is_objective, description, smart_specific, smart_measurable, smart_achievable, smart_relevant, priority, status, created_at)
                    SELECT id, text, completed, 'Perso', due_date, recurring, sort_order,
                           COALESCE(is_objective, 0), description,
                           smart_specific, smart_measurable, smart_achievable, smart_relevant,
                           COALESCE(priority, 'medium'), COALESCE(status, 'not_started'), created_at
                    FROM personal_todos
                ");
                $steps[] = "Migrated $count personal_todos into admin_todos with category='Perso'";
            } else {
                $steps[] = "personal_todos already migrated ($alreadyMigrated items with category='Perso')";
            }
        } else {
            $steps[] = "personal_todos is empty, nothing to migrate";
        }
    } else {
        $steps[] = "personal_todos table does not exist, skipping";
    }
} catch (Exception $e) {
    $steps[] = "ERROR migrating personal_todos: " . $e->getMessage();
}

// 3. Migrate simple todos into admin_todos
try {
    $exists = $pdo->query("SHOW TABLES LIKE 'todos'")->fetch();
    if ($exists) {
        $count = (int)$pdo->query("SELECT COUNT(*) FROM todos")->fetchColumn();
        if ($count > 0) {
            $alreadyMigrated = (int)$pdo->query("SELECT COUNT(*) FROM admin_todos WHERE category = 'Kojima-Solutions'")->fetchColumn();
            if ($alreadyMigrated === 0) {
                $pdo->exec("
                    INSERT INTO admin_todos (id, text, completed, category, due_date, sort_order, is_objective, priority, status, created_at)
                    SELECT id, text, completed, 'Kojima-Solutions', NULL, sort_order, 0, 'medium', 'not_started', created_at
                    FROM todos
                ");
                $steps[] = "Migrated $count todos into admin_todos with category='Kojima-Solutions'";
            } else {
                $steps[] = "todos already migrated ($alreadyMigrated items with category='Kojima-Solutions')";
            }
        } else {
            $steps[] = "todos is empty, nothing to migrate";
        }
    } else {
        $steps[] = "todos table does not exist, skipping";
    }
} catch (Exception $e) {
    $steps[] = "ERROR migrating todos: " . $e->getMessage();
}

// 4. Add flagged_today column to todo_subtasks
try {
    $cols = $pdo->query("SHOW COLUMNS FROM todo_subtasks LIKE 'flagged_today'")->fetchAll();
    if (empty($cols)) {
        $pdo->exec("ALTER TABLE todo_subtasks ADD COLUMN flagged_today TINYINT(1) NOT NULL DEFAULT 0");
        $steps[] = "Added 'flagged_today' column to todo_subtasks";
    } else {
        $steps[] = "'flagged_today' column already exists in todo_subtasks";
    }
} catch (Exception $e) {
    $steps[] = "ERROR adding flagged_today: " . $e->getMessage();
}

// 5a. Unify subtask source values
try {
    $updated = $pdo->exec("UPDATE todo_subtasks SET source = 'admin' WHERE source = 'personal'");
    $steps[] = "Unified $updated subtask source values to 'admin'";
} catch (Exception $e) {
    $steps[] = "ERROR updating subtask sources: " . $e->getMessage();
}

// 5. Create personal_docs table
try {
    $exists = $pdo->query("SHOW TABLES LIKE 'personal_docs'")->fetch();
    if (!$exists) {
        $pdo->exec("
            CREATE TABLE personal_docs (
                id            VARCHAR(36)   NOT NULL PRIMARY KEY,
                title         VARCHAR(255)  NOT NULL,
                category      VARCHAR(100)  NOT NULL DEFAULT 'Général',
                filename      VARCHAR(255)  NOT NULL,
                original_name VARCHAR(255)  NOT NULL,
                file_size     INT UNSIGNED  NOT NULL DEFAULT 0,
                created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $steps[] = "Created personal_docs table";
    } else {
        $steps[] = "personal_docs table already exists";
    }
} catch (Exception $e) {
    $steps[] = "ERROR creating personal_docs: " . $e->getMessage();
}

// 6. Create private_personal_docs directory
$personalDocsDir = realpath(__DIR__ . '/..') . '/private_personal_docs';
if (!is_dir($personalDocsDir)) {
    mkdir($personalDocsDir, 0750, true);
    $steps[] = "Created private_personal_docs/ directory";
} else {
    $steps[] = "private_personal_docs/ directory already exists";
}

echo "=== Migration Results ===\n\n";
foreach ($steps as $i => $step) {
    echo ($i + 1) . ". $step\n";
}
echo "\nDone. Delete this file from server now.\n";
