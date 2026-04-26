<?php
require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS objective_links (
            id           VARCHAR(36) PRIMARY KEY,
            source       ENUM('personal','admin') NOT NULL,
            objective_id VARCHAR(36) NOT NULL,
            url          TEXT         NOT NULL,
            title        VARCHAR(255) DEFAULT '',
            description  TEXT         DEFAULT NULL,
            favicon_url  VARCHAR(500) DEFAULT NULL,
            sort_order   INT          NOT NULL DEFAULT 0,
            created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_obj (source, objective_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
} catch (Throwable $e) {}

function mapLink(array $row): array {
    return [
        'id'          => $row['id'],
        'source'      => $row['source'],
        'objectiveId' => $row['objective_id'],
        'url'         => $row['url'],
        'title'       => $row['title'] ?? '',
        'description' => $row['description'] ?? null,
        'faviconUrl'  => $row['favicon_url'] ?? null,
        'order'       => (int)$row['sort_order'],
        'createdAt'   => $row['created_at'],
    ];
}

function deriveFavicon(?string $url): ?string {
    if (!$url) return null;
    $host = parse_url($url, PHP_URL_HOST);
    if (!$host) return null;
    return 'https://www.google.com/s2/favicons?domain=' . rawurlencode($host) . '&sz=64';
}

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id']           ?? null;
$source = $_GET['source']       ?? null;
$objId  = $_GET['objective_id'] ?? null;

if ($method === 'GET') {
    if (!$source || !$objId) fail('source and objective_id required');
    $stmt = $pdo->prepare('SELECT * FROM objective_links WHERE source = ? AND objective_id = ? ORDER BY sort_order ASC, created_at ASC');
    $stmt->execute([$source, $objId]);
    ok(array_map('mapLink', $stmt->fetchAll()));
}

if ($method === 'POST') {
    $data = body();
    $src  = $data['source']      ?? null;
    $oid  = $data['objectiveId'] ?? null;
    $url  = trim($data['url']    ?? '');
    if (!$src || !$oid || !$url) fail('source, objectiveId, url required');

    $newId = uuid();
    $stmtOrder = $pdo->prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 FROM objective_links WHERE source = ? AND objective_id = ?');
    $stmtOrder->execute([$src, $oid]);
    $nextOrder = (int)$stmtOrder->fetchColumn();

    $pdo->prepare('INSERT INTO objective_links (id, source, objective_id, url, title, description, favicon_url, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        ->execute([
            $newId, $src, $oid, $url,
            $data['title']       ?? '',
            $data['description'] ?? null,
            $data['faviconUrl']  ?? deriveFavicon($url),
            $nextOrder,
        ]);

    $stmt = $pdo->prepare('SELECT * FROM objective_links WHERE id = ?');
    $stmt->execute([$newId]);
    ok(mapLink($stmt->fetch()));
}

if ($method === 'PUT') {
    if (!$id) fail('Missing id');
    $data   = body();
    $fields = [];
    $values = [];
    $map = [
        'url'         => ['url = ?',         fn($v) => (string)$v],
        'title'       => ['title = ?',       fn($v) => (string)$v],
        'description' => ['description = ?', fn($v) => $v],
        'faviconUrl'  => ['favicon_url = ?', fn($v) => $v],
        'order'       => ['sort_order = ?',  fn($v) => (int)$v],
    ];
    foreach ($map as $key => [$sql, $cast]) {
        if (array_key_exists($key, $data)) {
            $fields[] = $sql;
            $values[] = $cast($data[$key]);
        }
    }
    if (!empty($fields)) {
        $values[] = $id;
        $pdo->prepare('UPDATE objective_links SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($values);
    }
    $stmt = $pdo->prepare('SELECT * FROM objective_links WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) fail('Not found', 404);
    ok(mapLink($row));
}

if ($method === 'DELETE') {
    if (!$id) fail('Missing id');
    $pdo->prepare('DELETE FROM objective_links WHERE id = ?')->execute([$id]);
    ok();
}

fail('Method not allowed', 405);
