<?php
require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

$method     = $_SERVER['REQUEST_METHOD'];
$id         = $_GET['id'] ?? null;
$uploadsDir = realpath(__DIR__ . '/../private_docs') ?: (__DIR__ . '/../private_docs');

function mapDoc(array $row): array {
    return [
        'id'           => $row['id'],
        'title'        => $row['title'],
        'category'     => $row['category'],
        'status'       => $row['status'] ?? 'filed',
        'urgent'       => (bool)($row['urgent'] ?? false),
        'folderId'     => $row['folder_id'],
        'year'         => $row['year'] ? (int)$row['year'] : null,
        'shareToken'   => $row['share_token'],
        'sortOrder'    => (int)$row['sort_order'],
        'filename'     => $row['filename'],
        'originalName' => $row['original_name'],
        'fileSize'     => (int)$row['file_size'],
        'createdAt'    => $row['created_at'],
    ];
}

function generateShareToken(): string {
    return bin2hex(random_bytes(24)); // 48-char hex token
}

/** Ensures the scan-triage columns (status, urgent) exist, adding them on the
 * fly the first time they're needed. This lets the À-trier feature work
 * without any separate manual migration step. */
function adminDocsHasTriage(PDO $pdo): bool {
    static $has = null;
    if ($has !== null) return $has;

    // Already present?
    try {
        $pdo->query('SELECT status, urgent FROM admin_docs LIMIT 0');
        return $has = true;
    } catch (Throwable $e) {
        // Missing — self-heal below.
    }

    // Add the columns. We only reach here when they're confirmed absent.
    try {
        $pdo->exec(
            "ALTER TABLE admin_docs "
            . "ADD COLUMN status ENUM('to_sort','filed') NOT NULL DEFAULT 'filed', "
            . "ADD COLUMN urgent TINYINT(1) NOT NULL DEFAULT 0"
        );
    } catch (Throwable $e2) {
        // A concurrent request may have won the race — the re-check decides.
    }

    try {
        $pdo->query('SELECT status, urgent FROM admin_docs LIMIT 0');
        return $has = true;
    } catch (Throwable $e3) {
        return $has = false;
    }
}

if ($method === 'GET') {
    adminDocsHasTriage($pdo); // self-heal the triage columns on first load
    $rows = $pdo->query('SELECT * FROM admin_docs ORDER BY sort_order, created_at DESC')->fetchAll();
    ok(array_map('mapDoc', $rows));
}

if ($method === 'POST') {
    $file = $_FILES['file'] ?? null;
    if (!$file || $file['error'] !== UPLOAD_ERR_OK) {
        fail('No file or upload error: ' . ($file['error'] ?? 'missing'));
    }

    $mime = mime_content_type($file['tmp_name']);
    if ($mime !== 'application/pdf') fail('Only PDF files are allowed');
    if (!validateMagicBytes($file['tmp_name'], $mime)) fail('File content does not match PDF format');
    if ($file['size'] > 25 * 1024 * 1024) fail('File too large (max 25 MB)');

    $title    = trim($_POST['title']    ?? '') ?: pathinfo($file['name'], PATHINFO_FILENAME);
    $category = trim($_POST['category'] ?? '') ?: 'Général';
    $folderId = trim($_POST['folderId'] ?? '') ?: null;
    $year     = isset($_POST['year']) && $_POST['year'] !== '' ? (int)$_POST['year'] : null;
    $status   = (($_POST['status'] ?? '') === 'to_sort') ? 'to_sort' : 'filed';
    $urgent   = (!empty($_POST['urgent']) && $_POST['urgent'] !== '0') ? 1 : 0;
    $docId    = uuid();
    $filename = $docId . '.pdf';

    if (!is_dir($uploadsDir)) mkdir($uploadsDir, 0750, true);

    $dest = $uploadsDir . '/' . $filename;
    if (!move_uploaded_file($file['tmp_name'], $dest)) fail('Failed to save file', 500);

    if (adminDocsHasTriage($pdo)) {
        $stmt = $pdo->prepare(
            'INSERT INTO admin_docs (id, title, category, status, urgent, folder_id, year, filename, original_name, file_size, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,NOW())'
        );
        $stmt->execute([$docId, $title, $category, $status, $urgent, $folderId, $year, $filename, $file['name'], $file['size']]);
    } else {
        $stmt = $pdo->prepare(
            'INSERT INTO admin_docs (id, title, category, folder_id, year, filename, original_name, file_size, created_at) VALUES (?,?,?,?,?,?,?,?,NOW())'
        );
        $stmt->execute([$docId, $title, $category, $folderId, $year, $filename, $file['name'], $file['size']]);
    }

    $row = $pdo->prepare('SELECT * FROM admin_docs WHERE id=?');
    $row->execute([$docId]);
    ok(mapDoc($row->fetch()));
}

if ($method === 'PUT' && $id) {
    $data = body();

    // Handle share/unshare action
    if (isset($data['action'])) {
        if ($data['action'] === 'share') {
            $token = generateShareToken();
            $pdo->prepare('UPDATE admin_docs SET share_token = ? WHERE id=?')->execute([$token, $id]);
            $row = $pdo->prepare('SELECT * FROM admin_docs WHERE id=?');
            $row->execute([$id]);
            ok(mapDoc($row->fetch()));
        }
        if ($data['action'] === 'unshare') {
            $pdo->prepare('UPDATE admin_docs SET share_token = NULL WHERE id=?')->execute([$id]);
            $row = $pdo->prepare('SELECT * FROM admin_docs WHERE id=?');
            $row->execute([$id]);
            ok(mapDoc($row->fetch()));
        }
    }

    $fields = [];
    $params = [];
    if (isset($data['title']))    { $fields[] = 'title = ?';     $params[] = $data['title']; }
    if (isset($data['category'])) { $fields[] = 'category = ?';  $params[] = $data['category']; }
    if (array_key_exists('folderId', $data)) { $fields[] = 'folder_id = ?'; $params[] = $data['folderId']; }
    if (array_key_exists('year', $data))       { $fields[] = 'year = ?';       $params[] = $data['year']; }
    if (array_key_exists('sortOrder', $data)) { $fields[] = 'sort_order = ?'; $params[] = (int)$data['sortOrder']; }
    if (adminDocsHasTriage($pdo)) {
        if (isset($data['status']) && in_array($data['status'], ['to_sort', 'filed'], true)) {
            $fields[] = 'status = ?'; $params[] = $data['status'];
        }
        if (array_key_exists('urgent', $data)) {
            $fields[] = 'urgent = ?'; $params[] = $data['urgent'] ? 1 : 0;
        }
    }
    if (empty($fields)) fail('Nothing to update');
    $params[] = $id;
    $pdo->prepare('UPDATE admin_docs SET ' . implode(', ', $fields) . ' WHERE id=?')->execute($params);
    $row = $pdo->prepare('SELECT * FROM admin_docs WHERE id=?');
    $row->execute([$id]);
    ok(mapDoc($row->fetch()));
}

if ($method === 'DELETE' && $id) {
    $row = $pdo->prepare('SELECT * FROM admin_docs WHERE id=?');
    $row->execute([$id]);
    $doc = $row->fetch();
    if ($doc) {
        $path = $uploadsDir . '/' . $doc['filename'];
        if (file_exists($path)) unlink($path);
        $pdo->prepare('DELETE FROM admin_docs WHERE id=?')->execute([$id]);
    }
    ok();
}

fail('Method not allowed', 405);
