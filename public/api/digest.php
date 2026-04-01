<?php
/**
 * Email digest — called by cron every 15-20 minutes.
 *
 * Infomaniak cron setup (Manager → Hébergement → Tâches planifiées):
 *   Command : php /home/clients/ba8c9a93b5cde03c1f26b6ea1c83c339/sites/kojima-solutions.ch/api/digest.php
 *   Interval: every 20 minutes  (or use URL call with CRON_KEY)
 *
 * Or trigger via URL (add CRON_KEY to config.php to protect it):
 *   https://kojima-solutions.ch/api/digest.php?key=YOUR_CRON_KEY
 */
require_once __DIR__ . '/_bootstrap.php';

// ── Auth: optional secret key to protect the URL endpoint ──
$key = $_GET['key'] ?? ($_SERVER['HTTP_X_CRON_KEY'] ?? '');
if (defined('CRON_KEY') && CRON_KEY !== '' && $key !== CRON_KEY) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

// ── Fetch all unsent notifications ──────────────────────────
$stmt    = $pdo->query('SELECT * FROM notifications WHERE sent = 0 ORDER BY created_at ASC');
$pending = $stmt->fetchAll();

if (empty($pending)) {
    ok(['sent' => false, 'reason' => 'No pending notifications']);
}

$adminEmail = defined('ADMIN_EMAIL') ? ADMIN_EMAIL : 'chraiti.massaki@gmail.com';
$siteUrl    = defined('SITE_URL')    ? SITE_URL    : 'https://kojima-solutions.ch';
$count      = count($pending);

// ── Group by project ────────────────────────────────────────
$byProject = [];
foreach ($pending as $n) {
    $pid = $n['project_id'] ?? 'unknown';
    if (!isset($byProject[$pid])) {
        $byProject[$pid] = ['title' => $n['project_title'], 'items' => []];
    }
    $byProject[$pid]['items'][] = $n;
}

// ── Build subject ───────────────────────────────────────────
if ($count === 1) {
    $subject = "🔔 Nouvelle réponse client — {$pending[0]['project_title']}";
} else {
    $projectCount = count($byProject);
    $subject = "🔔 {$count} nouvelles réponses clients"
             . ($projectCount > 1 ? " sur {$projectCount} projets" : " — {$pending[0]['project_title']}");
}

// ── Build body ──────────────────────────────────────────────
$body  = "Bonjour,\n\n";
$body .= "Vous avez {$count} nouvelle" . ($count > 1 ? 's' : '') . " réponse" . ($count > 1 ? 's' : '') . " client" . ($count > 1 ? 's' : '') . ".\n\n";

foreach ($byProject as $pid => $group) {
    $body .= "══ Projet : {$group['title']} ══\n\n";
    foreach ($group['items'] as $n) {
        $body .= "  Client   : {$n['client_name']}\n";
        $body .= "  Étape    : {$n['task_title']}\n";
        $body .= "  Demande  : {$n['question']}\n";
        $body .= "  Réponse  : {$n['response']}\n";
        $body .= "  Reçu le  : " . date('d/m/Y à H:i', strtotime($n['created_at'])) . "\n\n";
    }
}

$body .= "──────────────────────────\n";
$body .= "Voir l'espace admin : {$siteUrl}/space\n\n";
$body .= "Kojima Solutions";

$headers  = "From: noreply@kojima-solutions.ch\r\n";
$headers .= "Reply-To: noreply@kojima-solutions.ch\r\n";
$headers .= "Content-Type: text/plain; charset=utf-8\r\n";
$headers .= "X-Mailer: PHP/" . phpversion();

// ── Push notifications only (no auto-email) ───────────────────
$pushResults = ['sent' => 0, 'failed' => 0, 'expired' => 0];
if (file_exists(__DIR__ . '/push_send.php')) {
    require_once __DIR__ . '/push_send.php';
    $pushTitle = $count === 1
        ? "Réponse client — {$pending[0]['project_title']}"
        : "{$count} nouvelles réponses clients";
    $pushBody  = $count === 1
        ? "{$pending[0]['client_name']} : {$pending[0]['response']}"
        : "{$count} réponses sur " . count($byProject) . " projet(s)";
    $pushResults = sendPushNotifications($pdo, $pushTitle, $pushBody, '/space');
}

// Mark notifications as sent (push only, no email)
$ids          = array_column($pending, 'id');
$placeholders = implode(',', array_fill(0, count($ids), '?'));
$pdo->prepare("UPDATE notifications SET sent = 1, sent_at = NOW() WHERE id IN ({$placeholders})")
    ->execute($ids);

ok([
    'sent'  => true,
    'count' => $count,
    'email' => null,
    'push'  => $pushResults,
]);
