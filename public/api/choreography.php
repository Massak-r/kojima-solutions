<?php
require_once __DIR__ . '/_bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];

// ── Auto-create table ──
try {
    $pdo->exec('
        CREATE TABLE IF NOT EXISTS choreography (
            id VARCHAR(36) NOT NULL,
            timestamp_sec INT NOT NULL,
            order_num INT NOT NULL,
            figure VARCHAR(255) NOT NULL DEFAULT \'\',
            category VARCHAR(50) NOT NULL DEFAULT \'\',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_choreo_ts (timestamp_sec)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ');
} catch (Throwable $e) {}

// GET — list all entries
if ($method === 'GET') {
    $stmt = $pdo->query('SELECT * FROM choreography ORDER BY timestamp_sec, order_num');
    $rows = $stmt->fetchAll();
    ok(array_map(function ($r) {
        return [
            'id'        => $r['id'],
            'timestamp' => (int)$r['timestamp_sec'],
            'orderNum'  => (int)$r['order_num'],
            'figure'    => $r['figure'],
            'category'  => $r['category'],
            'createdAt' => $r['created_at'],
        ];
    }, $rows));
}

// POST — bulk save (replace all)
if ($method === 'POST') {
    $data    = body();
    $entries = $data['entries'] ?? [];

    $pdo->beginTransaction();
    try {
        $pdo->exec('DELETE FROM choreography');

        $stmt = $pdo->prepare('
            INSERT INTO choreography (id, timestamp_sec, order_num, figure, category)
            VALUES (?, ?, ?, ?, ?)
        ');

        $result = [];
        foreach ($entries as $e) {
            $id = uuid();
            $stmt->execute([
                $id,
                (int)($e['timestamp'] ?? 0),
                (int)($e['orderNum'] ?? 0),
                $e['figure'] ?? '',
                $e['category'] ?? '',
            ]);
            $result[] = [
                'id'        => $id,
                'timestamp' => (int)($e['timestamp'] ?? 0),
                'orderNum'  => (int)($e['orderNum'] ?? 0),
                'figure'    => $e['figure'] ?? '',
                'category'  => $e['category'] ?? '',
                'createdAt' => date('Y-m-d H:i:s'),
            ];
        }

        $pdo->commit();
        ok($result);
    } catch (Throwable $ex) {
        $pdo->rollBack();
        fail($ex->getMessage(), 500);
    }
}
