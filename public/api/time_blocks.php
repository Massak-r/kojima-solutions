<?php
require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

// Day-scoped time blocks for the "Aujourd'hui" schedule. Stored as
// minutes-from-midnight so the client math stays trivial and timezone-free.
// A block can stand alone (free block) or carry an hour for a sprint item via
// ref_kind/ref_id ('subtask'|'task'); end_min is optional ("à 14:00" suffit);
// done_min records the real completion minute for the estimation feedback.
// Auto-migrate on first hit. Idempotent.
try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS time_block (
            id          VARCHAR(36) PRIMARY KEY,
            day         DATE NOT NULL,
            start_min   SMALLINT UNSIGNED NOT NULL,
            end_min     SMALLINT UNSIGNED NULL,
            title       VARCHAR(255) NOT NULL DEFAULT '',
            color       VARCHAR(16) NULL,
            ref_kind    VARCHAR(16) NULL,
            ref_id      VARCHAR(64) NULL,
            done_min    SMALLINT UNSIGNED NULL,
            created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_day (day)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
} catch (Throwable $e) {}
try { $pdo->exec("ALTER TABLE time_block MODIFY COLUMN end_min SMALLINT UNSIGNED NULL"); } catch (Throwable $e) {}
try { $pdo->exec("ALTER TABLE time_block ADD COLUMN ref_kind VARCHAR(16) NULL"); } catch (Throwable $e) {}
try { $pdo->exec("ALTER TABLE time_block ADD COLUMN ref_id VARCHAR(64) NULL"); } catch (Throwable $e) {}
try { $pdo->exec("ALTER TABLE time_block ADD COLUMN done_min SMALLINT UNSIGNED NULL"); } catch (Throwable $e) {}

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? null;

function mapBlock(array $r): array {
    return [
        'id'        => $r['id'],
        'day'       => $r['day'],
        'startMin'  => (int)$r['start_min'],
        'endMin'    => isset($r['end_min']) ? (int)$r['end_min'] : null,
        'title'     => $r['title'],
        'color'     => $r['color'] ?? null,
        'refKind'   => $r['ref_kind'] ?? null,
        'refId'     => $r['ref_id'] ?? null,
        'doneMin'   => isset($r['done_min']) ? (int)$r['done_min'] : null,
        'createdAt' => $r['created_at'],
    ];
}

function clampMin($v): int {
    $n = (int)$v;
    if ($n < 0) return 0;
    if ($n > 1440) return 1440;
    return $n;
}

/** null stays null; anything else clamps to 0-1440. */
function clampMinOrNull($v): ?int {
    return $v === null ? null : clampMin($v);
}

/** Whitelisted sprint-item kinds a block may reference. */
function refKindOrNull($v): ?string {
    return in_array($v, ['subtask', 'task'], true) ? $v : null;
}

if ($method === 'GET') {
    $day = $_GET['day'] ?? '';
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $day)) fail('Invalid or missing day (YYYY-MM-DD)');
    $stmt = $pdo->prepare("SELECT * FROM time_block WHERE day = ? ORDER BY start_min, end_min");
    $stmt->execute([$day]);
    ok(array_map('mapBlock', $stmt->fetchAll()));
}

if ($method === 'POST') {
    $b   = body();
    $day = $b['day'] ?? '';
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $day)) fail('Invalid day');
    $start = clampMin($b['startMin'] ?? 0);
    $end   = clampMinOrNull($b['endMin'] ?? null);
    if ($end !== null && $end <= $start) fail('end must be after start');
    $title = trim((string)($b['title'] ?? ''));
    if (strlen($title) > 255) $title = substr($title, 0, 255);
    $color   = isset($b['color']) ? substr((string)$b['color'], 0, 16) : null;
    $refKind = refKindOrNull($b['refKind'] ?? null);
    $refId   = $refKind !== null && isset($b['refId']) ? substr((string)$b['refId'], 0, 64) : null;
    if ($refKind !== null && ($refId === null || $refId === '')) fail('refId required with refKind');

    // Upsert by ref: one hour per sprint item per day. Scheduling again
    // (double-tap, second device) updates the existing block instead of
    // stacking duplicates.
    if ($refKind !== null) {
        $dup = $pdo->prepare("SELECT id FROM time_block WHERE day = ? AND ref_kind = ? AND ref_id = ? LIMIT 1");
        $dup->execute([$day, $refKind, $refId]);
        $dupId = $dup->fetchColumn();
        if ($dupId) {
            $pdo->prepare("UPDATE time_block SET start_min = ?, end_min = ?, title = ? WHERE id = ?")
                ->execute([$start, $end, $title, $dupId]);
            $row = $pdo->prepare("SELECT * FROM time_block WHERE id = ?");
            $row->execute([$dupId]);
            ok(mapBlock($row->fetch()));
        }
    }

    $newId = uuid();
    $pdo->prepare("INSERT INTO time_block (id, day, start_min, end_min, title, color, ref_kind, ref_id) VALUES (?,?,?,?,?,?,?,?)")
        ->execute([$newId, $day, $start, $end, $title, $color ?: null, $refKind, $refId]);
    $row = $pdo->prepare("SELECT * FROM time_block WHERE id = ?");
    $row->execute([$newId]);
    ok(mapBlock($row->fetch()));
}

if ($method === 'PUT' && $id) {
    if (!preg_match('/^[0-9a-f-]{36}$/i', $id)) fail('Invalid id');
    $b = body();

    // Cross-validate the resulting start/end pair, even on partial updates.
    $cur = $pdo->prepare("SELECT * FROM time_block WHERE id = ?");
    $cur->execute([$id]);
    $existing = $cur->fetch();
    if (!$existing) fail('Not found', 404);
    $nextStart = array_key_exists('startMin', $b) ? clampMin($b['startMin']) : (int)$existing['start_min'];
    $nextEnd   = array_key_exists('endMin', $b)   ? clampMinOrNull($b['endMin'])
               : (isset($existing['end_min']) ? (int)$existing['end_min'] : null);
    if ($nextEnd !== null && $nextEnd <= $nextStart) fail('end must be after start');

    $fields = [];
    $params = [];
    if (array_key_exists('startMin', $b)) { $fields[] = 'start_min = ?'; $params[] = $nextStart; }
    if (array_key_exists('endMin', $b))   { $fields[] = 'end_min = ?';   $params[] = $nextEnd; }
    if (array_key_exists('doneMin', $b))  { $fields[] = 'done_min = ?';  $params[] = clampMinOrNull($b['doneMin']); }
    if (array_key_exists('title', $b))    { $fields[] = 'title = ?';     $params[] = substr(trim((string)$b['title']), 0, 255); }
    if (array_key_exists('color', $b))    { $fields[] = 'color = ?';     $params[] = $b['color'] ? substr((string)$b['color'], 0, 16) : null; }
    if (empty($fields)) fail('Nothing to update');
    $params[] = $id;
    $pdo->prepare("UPDATE time_block SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
    $row = $pdo->prepare("SELECT * FROM time_block WHERE id = ?");
    $row->execute([$id]);
    ok(mapBlock($row->fetch()));
}

if ($method === 'DELETE' && $id) {
    if (!preg_match('/^[0-9a-f-]{36}$/i', $id)) fail('Invalid id');
    $pdo->prepare("DELETE FROM time_block WHERE id = ?")->execute([$id]);
    ok();
}

fail('Method not allowed', 405);
