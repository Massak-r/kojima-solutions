<?php
require_once __DIR__ . '/_bootstrap.php';
requireAuth();

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? null;

// Ensure new columns exist
try { $pdo->exec('ALTER TABLE admin_doc_folders ADD COLUMN summary TEXT NULL'); } catch (\Exception $e) {}
try { $pdo->exec('ALTER TABLE admin_doc_folders ADD COLUMN links JSON NULL'); } catch (\Exception $e) {}
try { $pdo->exec('ALTER TABLE admin_doc_folders ADD COLUMN share_expires_at DATETIME NULL'); } catch (\Exception $e) {}

function mapFolder(array $row): array {
    $links = [];
    if (!empty($row['links'])) {
        $decoded = json_decode($row['links'], true);
        if (is_array($decoded)) $links = $decoded;
    }
    return [
        'id'         => $row['id'],
        'name'       => $row['name'],
        'parentId'   => $row['parent_id'],
        'sortOrder'  => (int)$row['sort_order'],
        'shareToken'    => $row['share_token'] ?? null,
        'shareExpiresAt' => $row['share_expires_at'] ?? null,
        'summary'    => $row['summary'] ?? null,
        'links'      => $links,
        'createdAt'  => $row['created_at'],
    ];
}

if ($method === 'GET') {
    $rows = $pdo->query('SELECT * FROM admin_doc_folders ORDER BY sort_order, name')->fetchAll();
    ok(array_map('mapFolder', $rows));
}

if ($method === 'POST') {
    $data = body();
    $name = trim($data['name'] ?? '');
    if (!$name) fail('Name is required');
    $parentId = $data['parentId'] ?? null;

    $folderId = uuid();
    $stmt = $pdo->prepare('INSERT INTO admin_doc_folders (id, name, parent_id, created_at) VALUES (?,?,?,NOW())');
    $stmt->execute([$folderId, $name, $parentId]);

    $row = $pdo->prepare('SELECT * FROM admin_doc_folders WHERE id=?');
    $row->execute([$folderId]);
    ok(mapFolder($row->fetch()));
}

if ($method === 'PUT' && $id) {
    $data = body();

    // Handle share/unshare
    if (isset($data['action'])) {
        if ($data['action'] === 'share') {
            $token = bin2hex(random_bytes(24));
            $days = (int)($data['expiresInDays'] ?? 30);
            $expiresAt = date('Y-m-d H:i:s', strtotime("+{$days} days"));
            $pdo->prepare('UPDATE admin_doc_folders SET share_token = ?, share_expires_at = ? WHERE id=?')->execute([$token, $expiresAt, $id]);
            $row = $pdo->prepare('SELECT * FROM admin_doc_folders WHERE id=?');
            $row->execute([$id]);
            ok(mapFolder($row->fetch()));
        }
        if ($data['action'] === 'unshare') {
            $pdo->prepare('UPDATE admin_doc_folders SET share_token = NULL, share_expires_at = NULL WHERE id=?')->execute([$id]);
            $row = $pdo->prepare('SELECT * FROM admin_doc_folders WHERE id=?');
            $row->execute([$id]);
            ok(mapFolder($row->fetch()));
        }
    }

    $fields = [];
    $params = [];
    if (isset($data['name'])) { $fields[] = 'name = ?'; $params[] = trim($data['name']); }
    if (array_key_exists('parentId', $data))  { $fields[] = 'parent_id = ?';  $params[] = $data['parentId']; }
    if (array_key_exists('sortOrder', $data)) { $fields[] = 'sort_order = ?'; $params[] = (int)$data['sortOrder']; }
    if (array_key_exists('summary', $data))   { $fields[] = 'summary = ?';    $params[] = $data['summary']; }
    if (array_key_exists('links', $data))     { $fields[] = 'links = ?';      $params[] = json_encode($data['links']); }
    if (empty($fields)) fail('Nothing to update');
    $params[] = $id;
    $pdo->prepare('UPDATE admin_doc_folders SET ' . implode(', ', $fields) . ' WHERE id=?')->execute($params);
    $row = $pdo->prepare('SELECT * FROM admin_doc_folders WHERE id=?');
    $row->execute([$id]);
    ok(mapFolder($row->fetch()));
}

if ($method === 'DELETE' && $id) {
    // Move docs in this folder (and subfolders) to root before deleting
    // Collect all descendant folder IDs
    $allIds = [$id];
    $queue  = [$id];
    while ($queue) {
        $current = array_shift($queue);
        $stmt = $pdo->prepare('SELECT id FROM admin_doc_folders WHERE parent_id=?');
        $stmt->execute([$current]);
        foreach ($stmt->fetchAll() as $child) {
            $allIds[] = $child['id'];
            $queue[]  = $child['id'];
        }
    }
    // Set docs in these folders to root
    $placeholders = implode(',', array_fill(0, count($allIds), '?'));
    $pdo->prepare("UPDATE admin_docs SET folder_id = NULL WHERE folder_id IN ($placeholders)")->execute($allIds);
    // Delete folder (CASCADE handles subfolders)
    $pdo->prepare('DELETE FROM admin_doc_folders WHERE id=?')->execute([$id]);
    ok();
}

fail('Method not allowed', 405);
