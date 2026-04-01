<?php
/**
 * Reusable client email sender.
 * Usage: require_once __DIR__ . '/_client_email.php';
 *        sendClientEmail('client@example.com', 'Subject', 'Body text', 'https://link');
 */

function sendClientEmail(string $to, string $subject, string $body, string $ctaUrl = ''): bool {
    if (!$to || !filter_var($to, FILTER_VALIDATE_EMAIL)) return false;

    $fullBody = $body;
    if ($ctaUrl) {
        $fullBody .= "\n\n→ " . $ctaUrl . "\n";
    }
    $fullBody .= "\n---\nKojima Solutions · kojima-solutions.ch\nmassaki@kojima-solutions.ch";

    $headers = implode("\r\n", [
        "From: Kojima Solutions <noreply@kojima-solutions.ch>",
        "Reply-To: massaki@kojima-solutions.ch",
        "Content-Type: text/plain; charset=UTF-8",
        "X-Mailer: PHP/" . phpversion(),
    ]);

    return @mail($to, $subject, $fullBody, $headers);
}
