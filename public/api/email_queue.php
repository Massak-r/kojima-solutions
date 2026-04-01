<?php
/**
 * Email Queue — stores outgoing emails for admin preview before sending.
 * No email is ever sent automatically. Admin must explicitly approve.
 */
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/_client_email.php';

// Auto-migrate
try {
    $pdo->exec('
        CREATE TABLE IF NOT EXISTS email_queue (
            id VARCHAR(36) PRIMARY KEY,
            recipient_email VARCHAR(255) NOT NULL,
            recipient_name VARCHAR(255) DEFAULT NULL,
            subject VARCHAR(500) NOT NULL,
            body TEXT NOT NULL,
            cta_url VARCHAR(500) DEFAULT NULL,
            source VARCHAR(100) NOT NULL DEFAULT "system",
            project_id VARCHAR(36) DEFAULT NULL,
            status ENUM("pending","sent","discarded") NOT NULL DEFAULT "pending",
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            sent_at DATETIME DEFAULT NULL,
            INDEX idx_status (status, created_at),
            INDEX idx_project (project_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ');
} catch (Throwable $e) {}

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? null;
$action = $_GET['action'] ?? null;

// GET — list queued emails (admin only)
if ($method === 'GET') {
    requireAuth();
    $status = $_GET['status'] ?? 'pending';
    $stmt = $pdo->prepare('SELECT * FROM email_queue WHERE status = ? ORDER BY created_at DESC LIMIT 100');
    $stmt->execute([$status]);
    ok($stmt->fetchAll());
}

// POST — queue a new email (internal use, auth required)
if ($method === 'POST' && !$action) {
    requireAuth();
    $d = body();
    $emailId = uuid();
    $pdo->prepare('
        INSERT INTO email_queue (id, recipient_email, recipient_name, subject, body, cta_url, source, project_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ')->execute([
        $emailId,
        $d['recipientEmail'] ?? '',
        $d['recipientName']  ?? null,
        $d['subject']        ?? '',
        $d['body']           ?? '',
        $d['ctaUrl']         ?? null,
        $d['source']         ?? 'manual',
        $d['projectId']      ?? null,
    ]);
    ok(['id' => $emailId]);
}

// PUT ?id=X&action=send — send a specific queued email
if ($method === 'PUT' && $id && $action === 'send') {
    requireAuth();
    $stmt = $pdo->prepare('SELECT * FROM email_queue WHERE id = ? AND status = "pending"');
    $stmt->execute([$id]);
    $email = $stmt->fetch();
    if (!$email) fail('Email not found or already processed', 404);

    $sent = sendClientEmail($email['recipient_email'], $email['subject'], $email['body'], $email['cta_url'] ?? '');
    if (!$sent) fail('mail() failed — check server config', 500);

    $pdo->prepare('UPDATE email_queue SET status = "sent", sent_at = NOW() WHERE id = ?')->execute([$id]);
    ok(['sent' => true]);
}

// PUT ?action=send-all — send all pending emails
if ($method === 'PUT' && $action === 'send-all') {
    requireAuth();
    $stmt = $pdo->query('SELECT * FROM email_queue WHERE status = "pending" ORDER BY created_at ASC');
    $pending = $stmt->fetchAll();
    $sent = 0;
    foreach ($pending as $email) {
        $ok = sendClientEmail($email['recipient_email'], $email['subject'], $email['body'], $email['cta_url'] ?? '');
        if ($ok) {
            $pdo->prepare('UPDATE email_queue SET status = "sent", sent_at = NOW() WHERE id = ?')->execute([$email['id']]);
            $sent++;
        }
    }
    ok(['sent' => $sent, 'total' => count($pending)]);
}

// PUT ?id=X&action=discard — discard a queued email
if ($method === 'PUT' && $id && $action === 'discard') {
    requireAuth();
    $pdo->prepare('UPDATE email_queue SET status = "discarded" WHERE id = ? AND status = "pending"')->execute([$id]);
    ok();
}

// PUT ?id=X&action=update — edit a queued email before sending
if ($method === 'PUT' && $id && $action === 'update') {
    requireAuth();
    $d = body();
    $sets = [];
    $vals = [];
    foreach (['recipient_email' => 'recipientEmail', 'subject' => 'subject', 'body' => 'body', 'cta_url' => 'ctaUrl'] as $col => $js) {
        if (isset($d[$js])) { $sets[] = "$col = ?"; $vals[] = $d[$js]; }
    }
    if ($sets) {
        $vals[] = $id;
        $pdo->prepare('UPDATE email_queue SET ' . implode(', ', $sets) . ' WHERE id = ? AND status = "pending"')->execute($vals);
    }
    $stmt = $pdo->prepare('SELECT * FROM email_queue WHERE id = ?');
    $stmt->execute([$id]);
    ok($stmt->fetch());
}

fail('Invalid request', 400);
