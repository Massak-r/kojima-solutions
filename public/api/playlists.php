<?php
require_once __DIR__ . '/_bootstrap.php';
requireAuthForWrites();

$method = $_SERVER['REQUEST_METHOD'];
$body   = body();
$id     = $_GET['id'] ?? null;

function rowToPlaylist(array $row): array {
  return [
    'id'        => $row['id'],
    'type'      => $row['type'],
    'email'     => $row['email'],
    'name'      => $row['name'],
    'isShared'  => (bool)$row['is_shared'],
    'createdAt' => $row['created_at'],
  ];
}

// ── GET: list playlists for email+type + shared ones ─────────
if ($method === 'GET') {
  $type  = $_GET['type']  ?? null;
  $email = $_GET['email'] ?? null;
  if (!$type) { http_response_code(400); echo json_encode(['error'=>'type required']); exit; }

  // Always return: playlists owned by this email (if provided) + all shared playlists for type
  if ($email) {
    $stmt = $pdo->prepare(
      'SELECT * FROM playlists WHERE type = ? AND (email = ? OR is_shared = 1) ORDER BY created_at ASC'
    );
    $stmt->execute([$type, $email]);
  } else {
    // Admin view: all playlists for type
    $stmt = $pdo->prepare('SELECT * FROM playlists WHERE type = ? ORDER BY created_at ASC');
    $stmt->execute([$type]);
  }
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

  // Attach items for each playlist
  $ids = array_column($rows, 'id');
  $itemsMap = [];
  if ($ids) {
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $iStmt = $pdo->prepare(
      "SELECT * FROM playlist_items WHERE playlist_id IN ($placeholders) ORDER BY sort_order ASC"
    );
    $iStmt->execute($ids);
    foreach ($iStmt->fetchAll(PDO::FETCH_ASSOC) as $item) {
      $itemsMap[$item['playlist_id']][] = [
        'id'         => $item['id'],
        'playlistId' => $item['playlist_id'],
        'moveId'     => $item['move_id'],
        'sortOrder'  => (int)$item['sort_order'],
      ];
    }
  }

  $result = [];
  foreach ($rows as $row) {
    $pl = rowToPlaylist($row);
    $pl['items'] = $itemsMap[$row['id']] ?? [];
    $result[] = $pl;
  }
  echo json_encode($result);
  exit;
}

// ── POST: create playlist ─────────────────────────────────────
if ($method === 'POST') {
  $type     = $body['type']     ?? null;
  $email    = $body['email']    ?? null;
  $name     = $body['name']     ?? null;
  $isShared = isset($body['isShared']) ? (int)(bool)$body['isShared'] : 0;

  if (!$type || !$email || !$name) {
    http_response_code(400); echo json_encode(['error'=>'type, email, name required']); exit;
  }

  $newId = uuid();
  $stmt = $pdo->prepare(
    'INSERT INTO playlists (id, type, email, name, is_shared) VALUES (?, ?, ?, ?, ?)'
  );
  $stmt->execute([$newId, $type, $email, $name, $isShared]);

  $stmtR = $pdo->prepare("SELECT * FROM playlists WHERE id = ?");
  $stmtR->execute([$newId]);
  $row = $stmtR->fetch(PDO::FETCH_ASSOC);
  $pl  = rowToPlaylist($row);
  $pl['items'] = [];
  echo json_encode($pl);
  exit;
}

// ── PATCH: update playlist name / isShared ────────────────────
if ($method === 'PATCH') {
  if (!$id) { http_response_code(400); echo json_encode(['error'=>'id required']); exit; }

  $sets = [];
  $params = [];
  if (isset($body['name']))     { $sets[] = 'name = ?';      $params[] = $body['name']; }
  if (isset($body['isShared'])) { $sets[] = 'is_shared = ?'; $params[] = (int)(bool)$body['isShared']; }

  if ($sets) {
    $params[] = $id;
    $pdo->prepare('UPDATE playlists SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);
  }

  $row = $pdo->prepare('SELECT * FROM playlists WHERE id = ?');
  $row->execute([$id]);
  $pl = rowToPlaylist($row->fetch(PDO::FETCH_ASSOC));

  $iStmt = $pdo->prepare('SELECT * FROM playlist_items WHERE playlist_id = ? ORDER BY sort_order ASC');
  $iStmt->execute([$id]);
  $pl['items'] = array_map(fn($i) => [
    'id' => $i['id'], 'playlistId' => $i['playlist_id'],
    'moveId' => $i['move_id'], 'sortOrder' => (int)$i['sort_order'],
  ], $iStmt->fetchAll(PDO::FETCH_ASSOC));

  echo json_encode($pl);
  exit;
}

// ── DELETE: delete playlist (cascade deletes items) ──────────
if ($method === 'DELETE') {
  if (!$id) { http_response_code(400); echo json_encode(['error'=>'id required']); exit; }
  $pdo->prepare('DELETE FROM playlists WHERE id = ?')->execute([$id]);
  echo json_encode(['ok' => true]);
  exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
