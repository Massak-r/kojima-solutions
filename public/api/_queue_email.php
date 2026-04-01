<?php
/**
 * Queue an email for admin review instead of sending it directly.
 * Usage: require_once __DIR__ . '/_queue_email.php';
 *        queueEmail($pdo, 'client@example.com', 'Client Name', 'Subject', 'Body', 'https://link', 'source', 'projectId');
 */

function queueEmail(
    PDO $pdo,
    string $to,
    ?string $recipientName,
    string $subject,
    string $body,
    string $ctaUrl = '',
    string $source = 'system',
    ?string $projectId = null
): string {
    // Auto-create table if needed
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

    $id = uuid();
    $pdo->prepare('
        INSERT INTO email_queue (id, recipient_email, recipient_name, subject, body, cta_url, source, project_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ')->execute([$id, $to, $recipientName, $subject, $body, $ctaUrl ?: null, $source, $projectId]);

    return $id;
}
