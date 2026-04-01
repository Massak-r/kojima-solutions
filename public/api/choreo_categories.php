<?php
require_once __DIR__ . '/_bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];

// ── Auto-create table ──
try {
    $pdo->exec('
        CREATE TABLE IF NOT EXISTS choreo_custom_categories (
            id VARCHAR(36) NOT NULL,
            label VARCHAR(100) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ');
} catch (Throwable $e) {}

// GET — list custom categories
if ($method === 'GET') {
    $stmt = $pdo->query('SELECT * FROM choreo_custom_categories ORDER BY label');
    $rows = $stmt->fetchAll();
    ok(array_map(function ($r) {
        return [
            'id'    => $r['id'],
            'label' => $r['label'],
        ];
    }, $rows));
}

// POST — add a custom category
if ($method === 'POST') {
    $data  = body();
    $label = trim($data['label'] ?? '');

    if ($label === '') {
        fail('Label is required', 400);
    }

    $id = uuid();
    $stmt = $pdo->prepare('INSERT INTO choreo_custom_categories (id, label) VALUES (?, ?)');
    $stmt->execute([$id, $label]);

    ok(['id' => $id, 'label' => $label]);
}

// DELETE — remove a custom category
if ($method === 'DELETE') {
    $data = body();
    $id   = $data['id'] ?? '';

    if ($id === '') {
        fail('ID is required', 400);
    }

    $stmt = $pdo->prepare('DELETE FROM choreo_custom_categories WHERE id = ?');
    $stmt->execute([$id]);

    ok(['deleted' => true]);
}
