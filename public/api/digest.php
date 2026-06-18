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

// ── Scheduled push reminders due now ─────────────────────────
// Fires any reminder whose scheduled_at has passed, reusing the web-push path.
// Runs before the notifications early-return so reminders go out even when
// there's no client feedback pending.
$reminderResults = ['sent' => 0];
try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS push_reminders (
            id            VARCHAR(36) PRIMARY KEY,
            title         VARCHAR(255) NOT NULL,
            body          TEXT NULL,
            url           VARCHAR(512) NOT NULL DEFAULT '/home',
            scheduled_at  DATETIME NOT NULL,
            sent_at       DATETIME NULL,
            created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_due (sent_at, scheduled_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    $due = $pdo->query("SELECT * FROM push_reminders WHERE sent_at IS NULL AND scheduled_at <= UTC_TIMESTAMP() ORDER BY scheduled_at ASC LIMIT 50")->fetchAll();
    if ($due && file_exists(__DIR__ . '/push_send.php')) {
        require_once __DIR__ . '/push_send.php';
        $mark = $pdo->prepare("UPDATE push_reminders SET sent_at = NOW() WHERE id = ?");
        foreach ($due as $r) {
            sendPushNotifications($pdo, $r['title'], (string)($r['body'] ?? ''), $r['url'] ?: '/home');
            $mark->execute([$r['id']]);
            $reminderResults['sent']++;
        }
    }
} catch (Throwable $e) { /* reminders are best-effort; never break the digest */ }

// ── Snoozed inbox captures due now ───────────────────────────
// A woken capture is already back in the pending list (the inbox GET filter
// shows it once snoozed_until has passed); here we additionally fire one push
// nudge and clear snoozed_until so it stops counting as snoozed. Best-effort.
$snoozeResults = ['woken' => 0];
try { $pdo->exec("ALTER TABLE inbox_capture ADD COLUMN snoozed_until DATETIME NULL DEFAULT NULL"); } catch (Throwable $e) {}
try {
    $woke = $pdo->query("SELECT id, text FROM inbox_capture WHERE triaged_at IS NULL AND snoozed_until IS NOT NULL AND snoozed_until <= UTC_TIMESTAMP() ORDER BY snoozed_until ASC LIMIT 100")->fetchAll();
    if ($woke) {
        if (file_exists(__DIR__ . '/push_send.php')) {
            require_once __DIR__ . '/push_send.php';
            $n     = count($woke);
            $first = trim((string)($woke[0]['text'] ?? ''));
            if (strlen($first) > 80) $first = substr($first, 0, 77) . '…';
            $title = $n === 1 ? 'Capture à trier' : "$n captures à trier";
            $body  = $n === 1 ? $first : 'Elles reviennent dans ton inbox.';
            sendPushNotifications($pdo, $title, $body, '/home');
        }
        $ids = array_column($woke, 'id');
        $ph  = implode(',', array_fill(0, count($ids), '?'));
        $pdo->prepare("UPDATE inbox_capture SET snoozed_until = NULL WHERE id IN ($ph)")->execute($ids);
        $snoozeResults['woken'] = count($ids);
    }
} catch (Throwable $e) { /* best-effort; never break the digest */ }

// ── Fetch all unsent notifications ──────────────────────────
$stmt    = $pdo->query('SELECT * FROM notifications WHERE sent = 0 ORDER BY created_at ASC');
$pending = $stmt->fetchAll();

if (empty($pending)) {
    ok(['sent' => false, 'reason' => 'No pending notifications', 'reminders' => $reminderResults, 'snooze' => $snoozeResults]);
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
    'sent'      => true,
    'count'     => $count,
    'email'     => null,
    'push'      => $pushResults,
    'reminders' => $reminderResults,
    'snooze'    => $snoozeResults,
]);
