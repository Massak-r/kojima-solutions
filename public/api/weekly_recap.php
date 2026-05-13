<?php
require_once __DIR__ . '/_bootstrap.php';

// Auto-migrate the table on first hit. Idempotent.
try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS weekly_recap (
            id           VARCHAR(36) PRIMARY KEY,
            iso_year     INT NOT NULL,
            iso_week     INT NOT NULL,
            content_md   MEDIUMTEXT NOT NULL,
            generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            dismissed_at DATETIME NULL,
            UNIQUE KEY uniq_year_week (iso_year, iso_week),
            INDEX idx_year_week (iso_year, iso_week)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
} catch (Throwable $e) {}

// ISO-week of a given Y-m-d (UTC). Mirrors the JS isoWeekOf() in
// src/lib/recurrencePeriod.ts so the client and server agree on indices.
function isoYearWeek(?string $date = null): array {
    $ts = $date ? strtotime($date) : time();
    // GMT-safe ISO week (PHP's 'o' = ISO year, 'W' = ISO week)
    return [(int)gmdate('o', $ts), (int)gmdate('W', $ts)];
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // GET ?week=current  →  current ISO week, non-dismissed
    // GET ?year=Y&week=W →  specific
    requireAdminSession();
    [$y, $w] = isoYearWeek();
    if (isset($_GET['year']) && isset($_GET['week'])) {
        $y = (int)$_GET['year'];
        $w = (int)$_GET['week'];
    }
    $stmt = $pdo->prepare("
        SELECT id, iso_year, iso_week, content_md, generated_at, dismissed_at
        FROM weekly_recap
        WHERE iso_year = ? AND iso_week = ?
        LIMIT 1
    ");
    $stmt->execute([$y, $w]);
    $row = $stmt->fetch();
    if (!$row) {
        ok(['exists' => false, 'iso_year' => $y, 'iso_week' => $w]);
    }
    ok([
        'exists'       => true,
        'id'           => $row['id'],
        'iso_year'     => (int)$row['iso_year'],
        'iso_week'     => (int)$row['iso_week'],
        'content_md'   => $row['content_md'],
        'generated_at' => $row['generated_at'],
        'dismissed_at' => $row['dismissed_at'],
    ]);
}

if ($method === 'POST') {
    // POST { iso_year, iso_week, content_md } with X-Recap-Upload-Key header.
    // This is the "agent upload" path — auth via a narrow-scope secret distinct
    // from API_SECRET so the remote routine prompt can carry it with limited
    // blast radius (only action possible = upsert one recap text).
    if (!defined('RECAP_UPLOAD_SECRET') || RECAP_UPLOAD_SECRET === '') {
        fail('RECAP_UPLOAD_SECRET not configured on the server', 503);
    }
    $key = $_SERVER['HTTP_X_RECAP_UPLOAD_KEY'] ?? '';
    if (!hash_equals(RECAP_UPLOAD_SECRET, $key)) {
        fail('Invalid upload key', 401);
    }
    $body = json_decode(file_get_contents('php://input'), true);
    $y    = isset($body['iso_year']) ? (int)$body['iso_year'] : 0;
    $w    = isset($body['iso_week']) ? (int)$body['iso_week'] : 0;
    $md   = isset($body['content_md']) ? (string)$body['content_md'] : '';
    if ($y < 2020 || $y > 2100) fail('iso_year out of range');
    if ($w < 1   || $w > 53)    fail('iso_week out of range');
    if (trim($md) === '')       fail('content_md must not be empty');

    $existing = $pdo->prepare("SELECT id FROM weekly_recap WHERE iso_year = ? AND iso_week = ?");
    $existing->execute([$y, $w]);
    $row = $existing->fetch();
    if ($row) {
        $pdo->prepare("UPDATE weekly_recap SET content_md = ?, generated_at = NOW(), dismissed_at = NULL WHERE id = ?")
            ->execute([$md, $row['id']]);
        ok(['id' => $row['id'], 'updated' => true]);
    }
    $id = uuid();
    $pdo->prepare("INSERT INTO weekly_recap (id, iso_year, iso_week, content_md) VALUES (?, ?, ?, ?)")
        ->execute([$id, $y, $w, $md]);
    ok(['id' => $id, 'created' => true]);
}

if ($method === 'PATCH') {
    // PATCH ?week=current&dismiss=1   marks the current week's recap as read.
    requireAdminSession();
    [$y, $w] = isoYearWeek();
    if (!empty($_GET['dismiss'])) {
        $pdo->prepare("UPDATE weekly_recap SET dismissed_at = NOW() WHERE iso_year = ? AND iso_week = ? AND dismissed_at IS NULL")
            ->execute([$y, $w]);
        ok(['dismissed' => true]);
    }
    fail('Nothing to do', 400);
}

fail('Method not allowed', 405);
