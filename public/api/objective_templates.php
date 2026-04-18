<?php
require_once __DIR__ . '/_bootstrap.php';
requireAuth();

try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS objective_templates (
            id           VARCHAR(36) PRIMARY KEY,
            name         VARCHAR(255) NOT NULL,
            description  TEXT         DEFAULT NULL,
            source_objective_id VARCHAR(36) DEFAULT NULL,
            created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS objective_template_items (
            id             VARCHAR(36) PRIMARY KEY,
            template_id    VARCHAR(36) NOT NULL,
            parent_item_id VARCHAR(36) DEFAULT NULL,
            text           VARCHAR(500) NOT NULL,
            description    TEXT DEFAULT NULL,
            priority       ENUM('low','medium','high') DEFAULT 'medium',
            effort_size    ENUM('rapide','moyen','complexe') DEFAULT NULL,
            sort_order     INT NOT NULL DEFAULT 0,
            INDEX idx_tpl (template_id),
            INDEX idx_parent_item (parent_item_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
} catch (Throwable $e) {}

function mapTemplate(array $row, ?int $itemCount = null): array {
    $out = [
        'id'                => $row['id'],
        'name'              => $row['name'],
        'description'       => $row['description'] ?? null,
        'sourceObjectiveId' => $row['source_objective_id'] ?? null,
        'createdAt'         => $row['created_at'],
        'updatedAt'         => $row['updated_at'],
    ];
    if ($itemCount !== null) $out['itemCount'] = $itemCount;
    return $out;
}

function mapTemplateItem(array $row): array {
    return [
        'id'           => $row['id'],
        'templateId'   => $row['template_id'],
        'parentItemId' => $row['parent_item_id'] ?? null,
        'text'         => $row['text'],
        'description'  => $row['description'] ?? null,
        'priority'     => $row['priority'] ?? 'medium',
        'effortSize'   => $row['effort_size'] ?? null,
        'order'        => (int)$row['sort_order'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id']     ?? null;
$action = $_GET['action'] ?? null;

if ($method === 'GET') {
    if ($id) {
        $stmt = $pdo->prepare('SELECT * FROM objective_templates WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) fail('Not found', 404);

        $items = $pdo->prepare('SELECT * FROM objective_template_items WHERE template_id = ? ORDER BY sort_order ASC');
        $items->execute([$id]);
        $itemsData = array_map('mapTemplateItem', $items->fetchAll());

        $tpl = mapTemplate($row, count($itemsData));
        $tpl['items'] = $itemsData;
        ok($tpl);
    }
    $rows = $pdo->query('SELECT t.*, (SELECT COUNT(*) FROM objective_template_items WHERE template_id = t.id) AS item_count FROM objective_templates t ORDER BY updated_at DESC')->fetchAll();
    ok(array_map(fn($r) => mapTemplate($r, (int)$r['item_count']), $rows));
}

// POST ?action=apply — spawn subtasks from template onto an objective
if ($method === 'POST' && $action === 'apply') {
    $data        = body();
    $templateId  = $data['templateId']  ?? null;
    $source      = $data['source']      ?? null;
    $objectiveId = $data['objectiveId'] ?? null;
    if (!$templateId || !$source || !$objectiveId) fail('templateId, source, objectiveId required');

    $itemsStmt = $pdo->prepare('SELECT * FROM objective_template_items WHERE template_id = ? ORDER BY sort_order ASC');
    $itemsStmt->execute([$templateId]);
    $items = $itemsStmt->fetchAll();
    if (!$items) ok(['created' => 0]);

    // Determine current max orders at each (parent_subtask) level on the target objective
    $maxTopStmt = $pdo->prepare('SELECT COALESCE(MAX(sort_order), -1) FROM todo_subtasks WHERE source = ? AND parent_id = ? AND parent_subtask_id IS NULL');
    $maxTopStmt->execute([$source, $objectiveId]);
    $baseTopOrder = (int)$maxTopStmt->fetchColumn() + 1;

    // Map template_item_id -> new subtask_id
    $idMap = [];
    $created = 0;
    $pdo->beginTransaction();
    try {
        // Insert top-level items first (parent_item_id IS NULL)
        foreach ($items as $it) {
            if ($it['parent_item_id'] !== null) continue;
            $newId = uuid();
            $idMap[$it['id']] = $newId;
            $pdo->prepare('INSERT INTO todo_subtasks (id, source, parent_id, parent_subtask_id, text, completed, sort_order, description, priority, status, effort_size) VALUES (?, ?, ?, NULL, ?, 0, ?, ?, ?, ?, ?)')
                ->execute([
                    $newId, $source, $objectiveId, $it['text'],
                    $baseTopOrder + (int)$it['sort_order'],
                    $it['description'] ?? null,
                    $it['priority'] ?? 'medium',
                    'not_started',
                    $it['effort_size'] ?? null,
                ]);
            $created++;
        }
        // Then insert children under their new parent ids
        foreach ($items as $it) {
            if ($it['parent_item_id'] === null) continue;
            $newParent = $idMap[$it['parent_item_id']] ?? null;
            if (!$newParent) continue;
            $newId = uuid();
            $idMap[$it['id']] = $newId;
            $pdo->prepare('INSERT INTO todo_subtasks (id, source, parent_id, parent_subtask_id, text, completed, sort_order, description, priority, status, effort_size) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)')
                ->execute([
                    $newId, $source, $objectiveId, $newParent, $it['text'],
                    (int)$it['sort_order'],
                    $it['description'] ?? null,
                    $it['priority'] ?? 'medium',
                    'not_started',
                    $it['effort_size'] ?? null,
                ]);
            $created++;
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        fail('Failed to apply template: ' . $e->getMessage(), 500);
    }

    ok(['created' => $created]);
}

// POST — create template (optionally snapshot from an existing objective's subtasks)
if ($method === 'POST') {
    $data             = body();
    $name             = trim($data['name'] ?? '');
    if (!$name) fail('name required');
    $source           = $data['sourceSource']      ?? null;   // 'admin' | 'personal'
    $sourceObjectiveId= $data['sourceObjectiveId'] ?? null;

    $newId = uuid();
    $pdo->prepare('INSERT INTO objective_templates (id, name, description, source_objective_id) VALUES (?, ?, ?, ?)')
        ->execute([$newId, $name, $data['description'] ?? null, $sourceObjectiveId]);

    // If sourceObjectiveId provided, snapshot the objective's current subtask tree into items
    if ($source && $sourceObjectiveId) {
        $subs = $pdo->prepare('SELECT * FROM todo_subtasks WHERE source = ? AND parent_id = ? ORDER BY parent_subtask_id IS NULL DESC, sort_order ASC');
        $subs->execute([$source, $sourceObjectiveId]);
        $subsRows = $subs->fetchAll();

        $subToItem = [];
        // First pass: top-level
        foreach ($subsRows as $s) {
            if ($s['parent_subtask_id']) continue;
            $itemId = uuid();
            $subToItem[$s['id']] = $itemId;
            $pdo->prepare('INSERT INTO objective_template_items (id, template_id, parent_item_id, text, description, priority, effort_size, sort_order) VALUES (?, ?, NULL, ?, ?, ?, ?, ?)')
                ->execute([$itemId, $newId, $s['text'], $s['description'] ?? null, $s['priority'] ?? 'medium', $s['effort_size'] ?? null, (int)$s['sort_order']]);
        }
        // Second pass: children
        foreach ($subsRows as $s) {
            if (!$s['parent_subtask_id']) continue;
            $parentItemId = $subToItem[$s['parent_subtask_id']] ?? null;
            if (!$parentItemId) continue;
            $itemId = uuid();
            $subToItem[$s['id']] = $itemId;
            $pdo->prepare('INSERT INTO objective_template_items (id, template_id, parent_item_id, text, description, priority, effort_size, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
                ->execute([$itemId, $newId, $parentItemId, $s['text'], $s['description'] ?? null, $s['priority'] ?? 'medium', $s['effort_size'] ?? null, (int)$s['sort_order']]);
        }
    }

    $stmt = $pdo->prepare('SELECT * FROM objective_templates WHERE id = ?');
    $stmt->execute([$newId]);
    $row = $stmt->fetch();
    $countStmt = $pdo->prepare('SELECT COUNT(*) FROM objective_template_items WHERE template_id = ?');
    $countStmt->execute([$newId]);
    ok(mapTemplate($row, (int)$countStmt->fetchColumn()));
}

if ($method === 'PUT') {
    if (!$id) fail('Missing id');
    $data   = body();
    $fields = [];
    $values = [];
    if (array_key_exists('name', $data))        { $fields[] = 'name = ?';        $values[] = $data['name']; }
    if (array_key_exists('description', $data)) { $fields[] = 'description = ?'; $values[] = $data['description']; }
    if (empty($fields)) fail('Nothing to update');
    $values[] = $id;
    $pdo->prepare('UPDATE objective_templates SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($values);
    $stmt = $pdo->prepare('SELECT * FROM objective_templates WHERE id = ?');
    $stmt->execute([$id]);
    ok(mapTemplate($stmt->fetch()));
}

if ($method === 'DELETE') {
    if (!$id) fail('Missing id');
    $pdo->prepare('DELETE FROM objective_template_items WHERE template_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM objective_templates WHERE id = ?')->execute([$id]);
    ok();
}

fail('Method not allowed', 405);
