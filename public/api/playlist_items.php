<?php
require_once __DIR__ . '/_bootstrap.php';
requireAuthForWrites();

$method = $_SERVER['REQUEST_METHOD'];
$body   = body();

// ── POST: add move to playlist ────────────────────────────────
if ($method === 'POST') {
  $playlistId = $body['playlistId'] ?? null;
  $moveId     = $body['moveId']     ?? null;
  if (!$playlistId || !$moveId) {
    http_response_code(400); echo json_encode(['error'=>'playlistId and moveId required']); exit;
  }

  // Get current max sort_order for this playlist
  $maxStmt = $pdo->prepare('SELECT MAX(sort_order) as m FROM playlist_items WHERE playlist_id = ?');
  $maxStmt->execute([$playlistId]);
  $maxOrder = (int)($maxStmt->fetch(PDO::FETCH_ASSOC)['m'] ?? 0);

  $newId = uuid();
  try {
    $pdo->prepare(
      'INSERT INTO playlist_items (id, playlist_id, move_id, sort_order) VALUES (?, ?, ?, ?)'
    )->execute([$newId, $playlistId, $moveId, $maxOrder + 1]);
  } catch (PDOException $e) {
    if ($e->getCode() === '23000') {
      // Already in playlist — return existing
      $stmt = $pdo->prepare('SELECT * FROM playlist_items WHERE playlist_id = ? AND move_id = ?');
      $stmt->execute([$playlistId, $moveId]);
      $row = $stmt->fetch(PDO::FETCH_ASSOC);
      echo json_encode(['id' => $row['id'], 'playlistId' => $row['playlist_id'],
        'moveId' => $row['move_id'], 'sortOrder' => (int)$row['sort_order']]);
      exit;
    }
    throw $e;
  }

  echo json_encode(['id' => $newId, 'playlistId' => $playlistId,
    'moveId' => $moveId, 'sortOrder' => $maxOrder + 1]);
  exit;
}

// ── DELETE: remove move from playlist ─────────────────────────
if ($method === 'DELETE') {
  $playlistId = $_GET['playlist_id'] ?? $body['playlistId'] ?? null;
  $moveId     = $_GET['move_id']     ?? $body['moveId']     ?? null;
  $id         = $_GET['id']          ?? $body['id']         ?? null;

  if ($id) {
    $pdo->prepare('DELETE FROM playlist_items WHERE id = ?')->execute([$id]);
  } elseif ($playlistId && $moveId) {
    $pdo->prepare('DELETE FROM playlist_items WHERE playlist_id = ? AND move_id = ?')
        ->execute([$playlistId, $moveId]);
  } else {
    http_response_code(400); echo json_encode(['error'=>'id or (playlist_id + move_id) required']); exit;
  }

  echo json_encode(['ok' => true]);
  exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
