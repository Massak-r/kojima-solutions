<?php
/**
 * steps.php - Client/stakeholder actions on unified timeline steps
 * No admin auth required (public actions)
 */
require_once __DIR__ . '/_bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? null;       // task_id
$action = $_GET['action'] ?? null;

// ── POST: step actions ──────────────────────────────────────

if ($method === 'POST' && $id && $action) {
    $data = body();

    // ── Add comment to a step ──
    if ($action === 'comment') {
        $message = trim($data['message'] ?? '');
        if (!$message) fail('Missing message');

        $commentId = uuid();
        $pdo->prepare('
            INSERT INTO step_comments (id, task_id, author_name, author_email, author_role, message)
            VALUES (?, ?, ?, ?, ?, ?)
        ')->execute([
            $commentId,
            $id,
            $data['authorName'] ?? null,
            $data['authorEmail'] ?? null,
            $data['authorRole'] ?? 'client',
            $message,
        ]);

        $stmt = $pdo->prepare('SELECT * FROM step_comments WHERE id = ?');
        $stmt->execute([$commentId]);
        $row = $stmt->fetch();
        ok([
            'id'         => $row['id'],
            'taskId'     => $row['task_id'],
            'authorName' => $row['author_name'],
            'authorEmail'=> $row['author_email'],
            'authorRole' => $row['author_role'],
            'message'    => $row['message'],
            'createdAt'  => $row['created_at'],
        ]);
    }

    // ── Stakeholder casts a vote on a feedback request ──
    if ($action === 'stakeholder_vote') {
        $requestId = $data['requestId'] ?? null;
        if (!$requestId) fail('Missing requestId');

        $stmt = $pdo->prepare('SELECT * FROM feedback_requests WHERE id = ? AND task_id = ?');
        $stmt->execute([$requestId, $id]);
        $req = $stmt->fetch();
        if (!$req) fail('Feedback request not found', 404);

        $existingVotes = $req['stakeholder_votes'] ? json_decode($req['stakeholder_votes'], true) : [];

        $newVote = [
            'id'       => uuid(),
            'name'     => $data['name'] ?? 'Anonyme',
            'optionId' => $data['optionId'] ?? null,
            'vote'     => $data['vote'] ?? null,
            'comment'  => $data['comment'] ?? null,
            'votedAt'  => date('c'),
        ];

        // Replace existing vote from same stakeholder name, or add new
        $found = false;
        foreach ($existingVotes as &$v) {
            if ($v['name'] === $newVote['name']) {
                $v = $newVote;
                $found = true;
                break;
            }
        }
        unset($v);
        if (!$found) {
            $existingVotes[] = $newVote;
        }

        $pdo->prepare('UPDATE feedback_requests SET stakeholder_votes = ? WHERE id = ?')
            ->execute([json_encode($existingVotes), $requestId]);

        ok($newVote);
    }
}

// ── GET: list comments for a step ──
if ($method === 'GET' && $id) {
    $stmt = $pdo->prepare('SELECT * FROM step_comments WHERE task_id = ? ORDER BY created_at');
    $stmt->execute([$id]);
    $comments = [];
    foreach ($stmt->fetchAll() as $row) {
        $comments[] = [
            'id'         => $row['id'],
            'taskId'     => $row['task_id'],
            'authorName' => $row['author_name'],
            'authorEmail'=> $row['author_email'],
            'authorRole' => $row['author_role'],
            'message'    => $row['message'],
            'createdAt'  => $row['created_at'],
        ];
    }
    ok($comments);
}

fail('Invalid request');
