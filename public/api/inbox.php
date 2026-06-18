<?php
require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

// Server-authoritative inbox of quick captures. The local
// `.kojima-journal/inbox.md` becomes a legacy/offline mirror — the canonical
// source for the Monday popup and /triage skill is this table.
//
// Auto-migrate the table on first hit. Idempotent.
try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS inbox_capture (
            id                  VARCHAR(36) PRIMARY KEY,
            source              ENUM('admin','personal') NOT NULL DEFAULT 'admin',
            text                TEXT NOT NULL,
            project_hint        VARCHAR(255) NULL,
            created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            triaged_at          DATETIME NULL,
            triaged_destination VARCHAR(255) NULL,
            INDEX idx_triaged   (triaged_at),
            INDEX idx_source    (source, triaged_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
} catch (Throwable $e) {}

// Capture type (idea|todo|note|urgent) — optional 1-tap tag set at capture time
// to pre-seed triage. Idempotent; safe on existing rows (NULL = untyped).
try { $pdo->exec("ALTER TABLE inbox_capture ADD COLUMN kind VARCHAR(16) NULL DEFAULT NULL"); } catch (Throwable $e) {}

// Origin context — friendly label of the app section the capture was made from
// (e.g. "Trésorerie", "Pilotage"); informational for triage. Idempotent.
try { $pdo->exec("ALTER TABLE inbox_capture ADD COLUMN context VARCHAR(40) NULL DEFAULT NULL"); } catch (Throwable $e) {}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // GET ?status=pending|triaged|all  (default: pending)
    //     ?source=admin|personal       (default: admin)
    //     ?limit=N                     (default: 100)
    $status = $_GET['status'] ?? 'pending';
    $source = $_GET['source'] ?? 'admin';
    $limit  = max(1, min(500, (int)($_GET['limit'] ?? 100)));
    if (!in_array($source, ['admin', 'personal'], true)) fail('Invalid source');
    if (!in_array($status, ['pending', 'triaged', 'all'], true)) fail('Invalid status');

    $where = ['source = ?'];
    $args  = [$source];
    if ($status === 'pending') $where[] = 'triaged_at IS NULL';
    if ($status === 'triaged') $where[] = 'triaged_at IS NOT NULL';

    $sql = 'SELECT id, source, text, kind, context, project_hint, created_at, triaged_at, triaged_destination
            FROM inbox_capture
            WHERE ' . implode(' AND ', $where) . '
            ORDER BY created_at DESC
            LIMIT ' . $limit;
    $stmt = $pdo->prepare($sql);
    $stmt->execute($args);
    $rows = $stmt->fetchAll();

    // Also return a quick count of pending so the Monday popup doesn't need a
    // second roundtrip.
    $cstmt = $pdo->prepare("SELECT COUNT(*) FROM inbox_capture WHERE source = ? AND triaged_at IS NULL");
    $cstmt->execute([$source]);
    $pendingCount = (int)$cstmt->fetchColumn();

    ok([
        'pendingCount' => $pendingCount,
        'items'        => $rows,
    ]);
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    $text   = trim((string)($body['text'] ?? ''));
    $source = $body['source'] ?? 'admin';
    $hint   = isset($body['projectHint']) ? trim((string)$body['projectHint']) : null;
    $kind   = isset($body['kind']) ? trim((string)$body['kind']) : null;
    $context = isset($body['context']) ? trim((string)$body['context']) : null;
    if ($text === '') fail('text must not be empty');
    if (strlen($text) > 2000) fail('text too long (max 2000 chars)');
    if (!in_array($source, ['admin', 'personal'], true)) fail('Invalid source');
    if ($hint !== null && strlen($hint) > 255) fail('projectHint too long');
    if ($kind !== null && !in_array($kind, ['idea', 'todo', 'note', 'urgent'], true)) $kind = null;
    if ($context !== null) $context = substr($context, 0, 40);

    $id = uuid();
    $pdo->prepare("INSERT INTO inbox_capture (id, source, text, kind, context, project_hint) VALUES (?, ?, ?, ?, ?, ?)")
        ->execute([$id, $source, $text, $kind ?: null, $context ?: null, $hint ?: null]);

    $stmt = $pdo->prepare("SELECT id, source, text, kind, context, project_hint, created_at, triaged_at, triaged_destination FROM inbox_capture WHERE id = ?");
    $stmt->execute([$id]);
    ok($stmt->fetch());
}

if ($method === 'PATCH') {
    $id = $_GET['id'] ?? '';
    if (!preg_match('/^[0-9a-f-]{36}$/i', $id)) fail('Invalid id');
    $body = json_decode(file_get_contents('php://input'), true);

    if (array_key_exists('triaged', $body)) {
        if ($body['triaged'] === true) {
            $dest = isset($body['destination']) ? substr((string)$body['destination'], 0, 255) : null;
            $pdo->prepare("UPDATE inbox_capture SET triaged_at = NOW(), triaged_destination = ? WHERE id = ?")
                ->execute([$dest, $id]);
        } else {
            // un-triage (rare, but useful for undo)
            $pdo->prepare("UPDATE inbox_capture SET triaged_at = NULL, triaged_destination = NULL WHERE id = ?")
                ->execute([$id]);
        }
    }
    if (array_key_exists('text', $body)) {
        $text = trim((string)$body['text']);
        if ($text === '' || strlen($text) > 2000) fail('Invalid text');
        $pdo->prepare("UPDATE inbox_capture SET text = ? WHERE id = ?")->execute([$text, $id]);
    }
    ok(['id' => $id]);
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? '';
    if (!preg_match('/^[0-9a-f-]{36}$/i', $id)) fail('Invalid id');
    $pdo->prepare("DELETE FROM inbox_capture WHERE id = ?")->execute([$id]);
    ok();
}

fail('Method not allowed', 405);
