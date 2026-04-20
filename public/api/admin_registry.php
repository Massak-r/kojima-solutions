<?php
require_once __DIR__ . '/_bootstrap.php';
requireAuth();

$pdo->exec("CREATE TABLE IF NOT EXISTS admin_registry (
  id               VARCHAR(36)   NOT NULL,
  type             VARCHAR(30)   NOT NULL,
  name             VARCHAR(255)  NOT NULL,
  scope            VARCHAR(20)   NOT NULL DEFAULT 'personal',
  status           VARCHAR(20)   NOT NULL DEFAULT 'active',
  folder_id        VARCHAR(36)   NULL,
  notes            TEXT          NULL,
  meta             JSON          NULL,
  next_action_date DATE          NULL,
  remind_days      INT           NOT NULL DEFAULT 30,
  sort_order       INT           NOT NULL DEFAULT 0,
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (folder_id) REFERENCES admin_doc_folders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

function mapItem(array $row): array {
    $meta = isset($row['meta']) && $row['meta'] !== null ? json_decode($row['meta'], true) : null;
    return [
        'id'             => $row['id'],
        'type'           => $row['type'],
        'name'           => $row['name'],
        'scope'          => $row['scope'],
        'status'         => $row['status'],
        'folderId'       => $row['folder_id'],
        'notes'          => $row['notes'] ?? null,
        'meta'           => $meta,
        'nextActionDate' => $row['next_action_date'] ?? null,
        'remindDays'     => (int)$row['remind_days'],
        'sortOrder'      => (int)$row['sort_order'],
        'createdAt'      => $row['created_at'],
        'updatedAt'      => $row['updated_at'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? null;

if ($method === 'GET') {
    $rows = $pdo->query('SELECT * FROM admin_registry ORDER BY sort_order ASC, name ASC')->fetchAll();
    ok(array_map('mapItem', $rows));
}

if ($method === 'POST') {
    $data  = body();
    if (empty($data['type']) || empty($data['name'])) fail('type and name are required');
    $newId = uuid();

    $pdo->prepare('INSERT INTO admin_registry
        (id, type, name, scope, status, folder_id, notes, meta, next_action_date, remind_days, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        ->execute([
            $newId,
            $data['type'],
            $data['name'],
            $data['scope']           ?? 'personal',
            $data['status']          ?? 'active',
            $data['folderId']        ?? null,
            $data['notes']           ?? null,
            isset($data['meta'])     ? json_encode($data['meta']) : null,
            $data['nextActionDate']  ?? null,
            (int)($data['remindDays']  ?? 30),
            (int)($data['sortOrder']   ?? 0),
        ]);

    $stmt = $pdo->prepare('SELECT * FROM admin_registry WHERE id = ?');
    $stmt->execute([$newId]);
    ok(mapItem($stmt->fetch()));
}

if ($method === 'PUT') {
    if (!$id) fail('Missing id');
    $data   = body();
    $fields = [];
    $values = [];

    if (array_key_exists('name',           $data)) { $fields[] = 'name = ?';             $values[] = $data['name']; }
    if (array_key_exists('scope',          $data)) { $fields[] = 'scope = ?';            $values[] = $data['scope']; }
    if (array_key_exists('status',         $data)) { $fields[] = 'status = ?';           $values[] = $data['status']; }
    if (array_key_exists('folderId',       $data)) { $fields[] = 'folder_id = ?';        $values[] = $data['folderId']; }
    if (array_key_exists('notes',          $data)) { $fields[] = 'notes = ?';            $values[] = $data['notes']; }
    if (array_key_exists('meta',           $data)) { $fields[] = 'meta = ?';             $values[] = json_encode($data['meta']); }
    if (array_key_exists('nextActionDate', $data)) { $fields[] = 'next_action_date = ?'; $values[] = $data['nextActionDate']; }
    if (array_key_exists('remindDays',     $data)) { $fields[] = 'remind_days = ?';      $values[] = (int)$data['remindDays']; }
    if (array_key_exists('sortOrder',      $data)) { $fields[] = 'sort_order = ?';       $values[] = (int)$data['sortOrder']; }

    if (!empty($fields)) {
        $values[] = $id;
        $pdo->prepare('UPDATE admin_registry SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($values);
    }

    $stmt = $pdo->prepare('SELECT * FROM admin_registry WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) fail('Entry not found', 404);
    ok(mapItem($row));
}

if ($method === 'DELETE') {
    if (!$id) fail('Missing id');
    $pdo->prepare('DELETE FROM admin_registry WHERE id = ?')->execute([$id]);
    ok();
}
