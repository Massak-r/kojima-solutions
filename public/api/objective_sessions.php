<?php
require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS objective_sessions (
            id           VARCHAR(36) PRIMARY KEY,
            source       ENUM('personal','admin') NOT NULL,
            objective_id VARCHAR(36) NOT NULL,
            subtask_id   VARCHAR(36) DEFAULT NULL,
            started_at   DATETIME    NOT NULL,
            ended_at     DATETIME    DEFAULT NULL,
            duration_sec INT         DEFAULT NULL,
            note         VARCHAR(500) DEFAULT NULL,
            accuracy     ENUM('faster','on_target','slower') DEFAULT NULL,
            INDEX idx_obj (source, objective_id),
            INDEX idx_open (source, objective_id, ended_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    // One-shot migration for installs that pre-date the accuracy column
    $cols = $pdo->query('SHOW COLUMNS FROM objective_sessions')->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('accuracy', $cols)) {
        $pdo->exec("ALTER TABLE objective_sessions ADD COLUMN accuracy ENUM('faster','on_target','slower') DEFAULT NULL");
    }
    // Ensure objective_activity exists (this endpoint emits into it)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS objective_activity (
            id           VARCHAR(36) PRIMARY KEY,
            source       ENUM('personal','admin') NOT NULL,
            objective_id VARCHAR(36) NOT NULL,
            kind         VARCHAR(40)  NOT NULL,
            payload      JSON         DEFAULT NULL,
            created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_obj_time (source, objective_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
} catch (Throwable $e) {}

function mapSession(array $row): array {
    return [
        'id'          => $row['id'],
        'source'      => $row['source'],
        'objectiveId' => $row['objective_id'],
        'subtaskId'   => $row['subtask_id'] ?? null,
        'startedAt'   => $row['started_at'],
        'endedAt'     => $row['ended_at'] ?? null,
        'durationSec' => $row['duration_sec'] !== null ? (int)$row['duration_sec'] : null,
        'note'        => $row['note'] ?? null,
        'accuracy'    => $row['accuracy'] ?? null,
    ];
}

function emitActivity(PDO $pdo, string $source, string $objectiveId, string $kind, array $payload = []): void {
    try {
        $pdo->prepare('INSERT INTO objective_activity (id, source, objective_id, kind, payload) VALUES (?, ?, ?, ?, ?)')
            ->execute([uuid(), $source, $objectiveId, $kind, json_encode($payload)]);
    } catch (Throwable $e) {}
}

function closeSession(PDO $pdo, string $sessionId, ?string $note = null): ?array {
    $stmt = $pdo->prepare('SELECT * FROM objective_sessions WHERE id = ? AND ended_at IS NULL');
    $stmt->execute([$sessionId]);
    $row = $stmt->fetch();
    if (!$row) return null;

    $pdo->prepare('UPDATE objective_sessions SET ended_at = NOW(), duration_sec = TIMESTAMPDIFF(SECOND, started_at, NOW()), note = COALESCE(?, note) WHERE id = ?')
        ->execute([$note, $sessionId]);

    $stmt = $pdo->prepare('SELECT * FROM objective_sessions WHERE id = ?');
    $stmt->execute([$sessionId]);
    $closed = $stmt->fetch();

    emitActivity($pdo, $closed['source'], $closed['objective_id'], 'session_ended', [
        'sessionId'   => $closed['id'],
        'subtaskId'   => $closed['subtask_id'],
        'durationSec' => (int)$closed['duration_sec'],
    ]);

    return $closed;
}

$method  = $_SERVER['REQUEST_METHOD'];
$id      = $_GET['id']           ?? null;
$action  = $_GET['action']       ?? null;
$source  = $_GET['source']       ?? null;
$objId   = $_GET['objective_id'] ?? null;
$summary = $_GET['summary']      ?? null;
$all     = isset($_GET['all']) && $_GET['all'] !== '0';

if ($method === 'GET') {
    // Global week summary (across ALL objectives) — doesn't require source+objective_id
    if ($summary === 'week' && $all) {
        $tz = new DateTimeZone(date_default_timezone_get());
        $now = new DateTime('now', $tz);
        $dow = (int)$now->format('N');
        $monday = (clone $now)->setTime(0, 0, 0)->modify('-' . ($dow - 1) . ' days');
        $nextMonday = (clone $monday)->modify('+7 days');
        $start = $monday->format('Y-m-d H:i:s');
        $end   = $nextMonday->format('Y-m-d H:i:s');

        // Daily totals
        $dayStmt = $pdo->prepare('
            SELECT DATE(started_at) AS d, COALESCE(SUM(duration_sec), 0) AS sec, COUNT(*) AS cnt
            FROM objective_sessions
            WHERE started_at >= ? AND started_at < ? AND duration_sec IS NOT NULL
            GROUP BY DATE(started_at)
        ');
        $dayStmt->execute([$start, $end]);
        $byDayMap = [];
        $totalSec = 0;
        $sessionCount = 0;
        foreach ($dayStmt->fetchAll() as $r) {
            $byDayMap[$r['d']] = (int)$r['sec'];
            $totalSec += (int)$r['sec'];
            $sessionCount += (int)$r['cnt'];
        }
        $byDay = [];
        for ($i = 0; $i < 7; $i++) {
            $d = (clone $monday)->modify('+' . $i . ' days')->format('Y-m-d');
            $byDay[] = ['date' => $d, 'sec' => $byDayMap[$d] ?? 0];
        }

        // Top objectives by focus time
        $objStmt = $pdo->prepare('
            SELECT source, objective_id, SUM(duration_sec) AS sec, COUNT(*) AS cnt
            FROM objective_sessions
            WHERE started_at >= ? AND started_at < ? AND duration_sec IS NOT NULL
            GROUP BY source, objective_id
            ORDER BY sec DESC
            LIMIT 10
        ');
        $objStmt->execute([$start, $end]);
        $byObjective = array_map(fn($r) => [
            'source'       => $r['source'],
            'objectiveId'  => $r['objective_id'],
            'sec'          => (int)$r['sec'],
            'sessionCount' => (int)$r['cnt'],
        ], $objStmt->fetchAll());

        ok([
            'totalSec'     => $totalSec,
            'sessionCount' => $sessionCount,
            'byDay'        => $byDay,
            'byObjective'  => $byObjective,
            'weekStart'    => $monday->format('Y-m-d'),
        ]);
    }

    if (!$source || !$objId) fail('source and objective_id required');

    if ($summary === 'week') {
        // ISO week: Monday 00:00 to next Monday 00:00
        $tz = new DateTimeZone(date_default_timezone_get());
        $now = new DateTime('now', $tz);
        $dow = (int)$now->format('N'); // 1 (Mon) .. 7 (Sun)
        $monday = (clone $now)->setTime(0, 0, 0)->modify('-' . ($dow - 1) . ' days');
        $nextMonday = (clone $monday)->modify('+7 days');

        $start = $monday->format('Y-m-d H:i:s');
        $end   = $nextMonday->format('Y-m-d H:i:s');

        $stmt = $pdo->prepare('
            SELECT DATE(started_at) AS d, COALESCE(SUM(duration_sec), 0) AS sec, COUNT(*) AS cnt
            FROM objective_sessions
            WHERE source = ? AND objective_id = ? AND started_at >= ? AND started_at < ? AND duration_sec IS NOT NULL
            GROUP BY DATE(started_at)
        ');
        $stmt->execute([$source, $objId, $start, $end]);
        $byDayMap = [];
        $totalSec = 0;
        $sessionCount = 0;
        foreach ($stmt->fetchAll() as $r) {
            $byDayMap[$r['d']] = (int)$r['sec'];
            $totalSec += (int)$r['sec'];
            $sessionCount += (int)$r['cnt'];
        }
        $byDay = [];
        for ($i = 0; $i < 7; $i++) {
            $d = (clone $monday)->modify('+' . $i . ' days')->format('Y-m-d');
            $byDay[] = ['date' => $d, 'sec' => $byDayMap[$d] ?? 0];
        }
        ok([
            'totalSec'     => $totalSec,
            'sessionCount' => $sessionCount,
            'byDay'        => $byDay,
            'weekStart'    => $monday->format('Y-m-d'),
        ]);
    }

    $stmt = $pdo->prepare('SELECT * FROM objective_sessions WHERE source = ? AND objective_id = ? ORDER BY started_at DESC LIMIT 200');
    $stmt->execute([$source, $objId]);
    ok(array_map('mapSession', $stmt->fetchAll()));
}

if ($method === 'POST') {
    // Stop via POST (sendBeacon-friendly)
    if ($id && $action === 'stop') {
        $note = $_POST['note'] ?? null;
        if ($note === null) {
            $data = body();
            $note = $data['note'] ?? null;
        }
        $closed = closeSession($pdo, $id, $note);
        ok($closed ? mapSession($closed) : ['ok' => true]);
    }

    // Start
    $data = body();
    $src  = $data['source']      ?? null;
    $oid  = $data['objectiveId'] ?? null;
    $sid  = $data['subtaskId']   ?? null;
    if (!$src || !$oid) fail('source and objectiveId required');

    // Auto-close any open session for the same (source, objective)
    $open = $pdo->prepare('SELECT id FROM objective_sessions WHERE source = ? AND objective_id = ? AND ended_at IS NULL');
    $open->execute([$src, $oid]);
    foreach ($open->fetchAll() as $r) {
        closeSession($pdo, $r['id'], 'auto-closed');
    }

    $newId = uuid();
    $pdo->prepare('INSERT INTO objective_sessions (id, source, objective_id, subtask_id, started_at) VALUES (?, ?, ?, ?, NOW())')
        ->execute([$newId, $src, $oid, $sid]);

    emitActivity($pdo, $src, $oid, 'session_started', [
        'sessionId' => $newId,
        'subtaskId' => $sid,
    ]);

    $stmt = $pdo->prepare('SELECT * FROM objective_sessions WHERE id = ?');
    $stmt->execute([$newId]);
    ok(mapSession($stmt->fetch()));
}

if ($method === 'PUT') {
    if (!$id) fail('Missing id');
    $data = body();
    if (($data['action'] ?? null) === 'stop') {
        $closed = closeSession($pdo, $id, $data['note'] ?? null);
        ok($closed ? mapSession($closed) : ['ok' => true]);
    }
    // Patch accuracy / note on an already-closed session (retro picker)
    $fields = [];
    $values = [];
    if (array_key_exists('accuracy', $data)) {
        $a = $data['accuracy'];
        if ($a !== null && !in_array($a, ['faster', 'on_target', 'slower'], true)) {
            fail('Invalid accuracy');
        }
        $fields[] = 'accuracy = ?';
        $values[] = $a;
    }
    if (array_key_exists('note', $data)) {
        $fields[] = 'note = ?';
        $values[] = $data['note'];
    }
    if (empty($fields)) fail('Nothing to update');
    $values[] = $id;
    $pdo->prepare('UPDATE objective_sessions SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($values);
    $stmt = $pdo->prepare('SELECT * FROM objective_sessions WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    ok($row ? mapSession($row) : ['ok' => true]);
}

if ($method === 'DELETE') {
    if (!$id) fail('Missing id');
    $pdo->prepare('DELETE FROM objective_sessions WHERE id = ?')->execute([$id]);
    ok();
}

fail('Method not allowed', 405);
