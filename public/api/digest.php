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

/** Effective due date (YYYY-MM-DD) for an admin checklist subtask, resolving a
 *  monthly recurrence to its next on/after-today occurrence. Null = no date
 *  (group headers, weekly/daily — not surfaced in the daily admin pulse). */
function adminPulseDue(array $s, DateTime $today): ?string {
    if (!empty($s['due_date'])) return substr((string)$s['due_date'], 0, 10);
    $rec = $s['recurrence'] ?? null;
    $day = ($s['recurrence_day'] !== null && $s['recurrence_day'] !== '') ? (int)$s['recurrence_day'] : null;
    if ($rec === 'monthly' && $day) {
        $d   = (int)$today->format('j');
        $dim = (int)$today->format('t');
        $t   = min($day, $dim);
        if ($d <= $t) return $today->format('Y-m-') . sprintf('%02d', $t);
        $nm = new DateTime($today->format('Y-m-01')); $nm->modify('+1 month');
        return $nm->format('Y-m-') . sprintf('%02d', min($day, (int)$nm->format('t')));
    }
    return null;
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

// ── Deadline scan: auto-flag upcoming / overdue deadlines ────
// Derives deadlines from existing data (validated invoices' échéances, client
// project end-dates) and the admin_deadlines table, and emits one notification
// per deadline (→ NotificationBell + push) exactly once via a dedup ledger.
// Recurring admin deadlines roll forward. Best-effort; never breaks the digest.
$deadlineResults = ['flagged' => 0];
try {
    $today = date('Y-m-d');
    $pdo->exec("CREATE TABLE IF NOT EXISTS deadline_alerts (
        alert_key  VARCHAR(191) NOT NULL PRIMARY KEY,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS admin_deadlines (
        id VARCHAR(36) NOT NULL PRIMARY KEY, title VARCHAR(255) NOT NULL, description TEXT NULL,
        due_date DATE NOT NULL, category VARCHAR(50) NOT NULL DEFAULT 'Général', recurring VARCHAR(20) NULL,
        remind_days INT NOT NULL DEFAULT 7, completed TINYINT(1) NOT NULL DEFAULT 0, completed_at DATETIME NULL,
        notified TINYINT(1) NOT NULL DEFAULT 0, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $notify = $pdo->prepare("INSERT INTO notifications (id, project_id, project_title, task_title, client_name, question, response)
                             VALUES (?, NULL, ?, ?, '', ?, '')");
    $claim  = $pdo->prepare("INSERT IGNORE INTO deadline_alerts (alert_key) VALUES (?)");
    $dayLabel = function (string $due) use ($today): string {
        $d = (int)((strtotime($due) - strtotime($today)) / 86400);
        if ($d < 0)   return 'En retard de ' . abs($d) . ' j';
        if ($d === 0) return "Échéance aujourd'hui";
        return "Échéance dans $d j";
    };

    // (a) Roll recurring admin deadlines forward when past due, then re-arm.
    $recMap = ['weekly'=>'+1 week','monthly'=>'+1 month','quarterly'=>'+3 months','biannual'=>'+6 months','yearly'=>'+1 year'];
    foreach ($pdo->query("SELECT id, due_date, recurring FROM admin_deadlines WHERE recurring IS NOT NULL AND recurring <> '' AND completed = 0 AND due_date < '$today'")->fetchAll() as $dl) {
        $step = $recMap[$dl['recurring']] ?? null;
        if (!$step) continue;
        $next = $dl['due_date']; $guard = 0;
        while (strtotime($next) < strtotime($today) && $guard++ < 200) { $next = date('Y-m-d', strtotime("$next $step")); }
        $pdo->prepare("UPDATE admin_deadlines SET due_date = ?, notified = 0 WHERE id = ?")->execute([$next, $dl['id']]);
    }

    // (b) admin_deadlines inside their remind window (manual + fiscal).
    $stmt = $pdo->prepare("SELECT * FROM admin_deadlines WHERE completed = 0 AND notified = 0 AND DATEDIFF(due_date, ?) <= remind_days AND DATEDIFF(due_date, ?) >= -30");
    $stmt->execute([$today, $today]);
    foreach ($stmt->fetchAll() as $dl) {
        $notify->execute([uuid(), 'Échéance · ' . $dl['category'], $dl['title'], $dayLabel($dl['due_date'])]);
        $pdo->prepare("UPDATE admin_deadlines SET notified = 1 WHERE id = ?")->execute([$dl['id']]);
        $deadlineResults['flagged']++;
    }

    // (c) Validated invoices due within 7 days or overdue.
    foreach ($pdo->query("SELECT id, quote_number, project_title, validity_date FROM quotes
                          WHERE doc_type = 'invoice' AND invoice_status = 'validated' AND validity_date IS NOT NULL
                            AND DATEDIFF(validity_date, '$today') <= 7 AND DATEDIFF(validity_date, '$today') >= -120")->fetchAll() as $q) {
        $claim->execute(['inv:' . $q['id'] . ':' . $q['validity_date']]);
        if ($claim->rowCount() === 0) continue;
        $label = trim(($q['quote_number'] ?? '') . ' · ' . ($q['project_title'] ?? ''), " ·");
        $notify->execute([uuid(), 'Facture', $label !== '' ? $label : ($q['quote_number'] ?? 'Facture'), $dayLabel($q['validity_date'])]);
        $deadlineResults['flagged']++;
    }

    // (d) Client projects in progress whose end date is within 7 days or overdue.
    foreach ($pdo->query("SELECT id, title, end_date FROM projects
                          WHERE kind = 'client' AND status = 'in-progress' AND end_date IS NOT NULL AND end_date <> ''
                            AND DATEDIFF(end_date, '$today') <= 7 AND DATEDIFF(end_date, '$today') >= -60")->fetchAll() as $pr) {
        $claim->execute(['proj:' . $pr['id'] . ':' . $pr['end_date']]);
        if ($claim->rowCount() === 0) continue;
        $notify->execute([uuid(), 'Projet', $pr['title'], $dayLabel($pr['end_date'])]);
        $deadlineResults['flagged']++;
    }
} catch (Throwable $e) { /* best-effort; never break the digest */ }

// ── Admin pulse: one adaptive daily push from the Centre admin's own data ────
// The deadline scan above never looks at the admin checklist subtasks/payables
// that drive the cockpit, so those obligations were silent. This sends ONE push
// per day (after pulse_hour, outside quiet hours) summarising what's due in the
// next 3 days or overdue, adaptive in tone (bientôt → aujourd'hui → en retard).
// Governed by notification_prefs (pulse on/off, hour, quiet hours). $quietNow is
// reused below to defer the feedback/deadline pushes during quiet hours.
$pulseResults = ['sent' => false];
$quietNow = false;
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS notification_prefs (
        id TINYINT NOT NULL PRIMARY KEY DEFAULT 1,
        admin_pulse_enabled TINYINT NOT NULL DEFAULT 1,
        pulse_hour TINYINT NOT NULL DEFAULT 8,
        quiet_start TINYINT NOT NULL DEFAULT 21,
        quiet_end TINYINT NOT NULL DEFAULT 8,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS deadline_alerts (
        alert_key VARCHAR(191) NOT NULL PRIMARY KEY, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $prefs = ['admin_pulse_enabled' => 1, 'pulse_hour' => 8, 'quiet_start' => 21, 'quiet_end' => 8];
    $row = $pdo->query("SELECT * FROM notification_prefs WHERE id = 1")->fetch();
    if ($row) $prefs = array_merge($prefs, $row);

    // Local time decisions in the founder's timezone (DST-aware), not server UTC.
    $nowLocal = new DateTime('now', new DateTimeZone('Europe/Zurich'));
    $hour     = (int)$nowLocal->format('G');
    $locDate  = $nowLocal->format('Y-m-d');
    $qs = (int)$prefs['quiet_start']; $qe = (int)$prefs['quiet_end'];
    $quietNow = ($qs === $qe) ? false : (($qs < $qe) ? ($hour >= $qs && $hour < $qe) : ($hour >= $qs || $hour < $qe));

    if ((int)$prefs['admin_pulse_enabled'] === 1 && !$quietNow && $hour >= (int)$prefs['pulse_hour']) {
        $daysTo = fn(string $due) => (int)(new DateTime($locDate))->diff(new DateTime($due))->format('%r%a');
        $items  = []; // [label, days]

        // (a) Admin checklist subtasks not done this period (recurring reset monthly).
        $objId = '96c0b590-8edf-45b2-a93f-9aff24c2ffd2';
        $sub = $pdo->prepare("SELECT text, due_date, recurrence, recurrence_day
            FROM todo_subtasks
            WHERE source = 'admin' AND parent_id = ?
              AND ( completed = 0
                    OR (recurrence IS NOT NULL AND recurrence <> ''
                        AND DATE_FORMAT(COALESCE(completed_at, '2000-01-01'), '%Y-%m') < ?) )");
        $sub->execute([$objId, $nowLocal->format('Y-m')]);
        foreach ($sub->fetchAll() as $s) {
            $due = adminPulseDue($s, $nowLocal);
            if ($due === null) continue;
            $days = $daysTo($due);
            if ($days <= 3 && $days >= -60) $items[] = ['label' => (string)$s['text'], 'days' => $days];
        }

        // (b) Entreprise payables (pending/scheduled) with a due date.
        foreach ($pdo->query("SELECT p.label, p.due_date
            FROM payables p LEFT JOIN accounts a ON a.id = p.account_id
            WHERE p.direction = 'out' AND p.status IN ('pending','scheduled')
              AND p.due_date IS NOT NULL AND a.type = 'entreprise'")->fetchAll() as $p) {
            $days = $daysTo(substr((string)$p['due_date'], 0, 10));
            if ($days <= 3 && $days >= -60) $items[] = ['label' => (string)$p['label'], 'days' => $days];
        }

        if (!empty($items)) {
            usort($items, fn($a, $b) => $a['days'] <=> $b['days']);
            // Claim once-per-day; only push if we win the claim.
            $claim = $pdo->prepare("INSERT IGNORE INTO deadline_alerts (alert_key) VALUES (?)");
            $claim->execute(['admin_pulse:' . $locDate]);
            if ($claim->rowCount() > 0 && file_exists(__DIR__ . '/push_send.php')) {
                require_once __DIR__ . '/push_send.php';
                $top   = $items[0];
                $label = strlen($top['label']) > 80 ? substr($top['label'], 0, 77) . '…' : $top['label'];
                $more  = count($items) - 1;
                $tail  = $more > 0 ? " · +$more autre" . ($more > 1 ? 's' : '') : '';
                if ($top['days'] < 0) {
                    $title = 'Admin · en retard';
                    $body  = "⚠️ $label (en retard de " . abs($top['days']) . " j)$tail";
                } elseif ($top['days'] === 0) {
                    $title = 'Admin du jour';
                    $body  = "Aujourd'hui : $label$tail";
                } else {
                    $title = 'Admin du jour';
                    $body  = "Dans {$top['days']} j : $label$tail";
                }
                sendPushNotifications($pdo, $title, $body, '/documents');
                $pulseResults = ['sent' => true, 'count' => count($items)];
            }
        }
    }
} catch (Throwable $e) { /* best-effort; never break the digest */ }

// ── Fetch all unsent notifications ──────────────────────────
$stmt    = $pdo->query('SELECT * FROM notifications WHERE sent = 0 ORDER BY created_at ASC');
$pending = $stmt->fetchAll();

if (empty($pending)) {
    ok(['sent' => false, 'reason' => 'No pending notifications', 'reminders' => $reminderResults, 'snooze' => $snoozeResults, 'deadlines' => $deadlineResults, 'pulse' => $pulseResults]);
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
// Deferred during quiet hours: the rows stay sent = 0 and push on the next run
// after quiet hours end. The in-app bell shows them immediately regardless.
$pushResults = ['sent' => 0, 'failed' => 0, 'expired' => 0];
if (!$quietNow && file_exists(__DIR__ . '/push_send.php')) {
    require_once __DIR__ . '/push_send.php';
    // Deadline notifications (project_title Facture/Projet/Échéance·…) get
    // their own copy + link so the push isn't mislabelled "réponses clients".
    $isDeadline = function ($n) {
        $pt = $n['project_title'] ?? '';
        return in_array($pt, ['Facture', 'Projet'], true) || str_starts_with((string)$pt, 'Échéance');
    };
    $dl = array_values(array_filter($pending, $isDeadline));
    $fb = array_values(array_filter($pending, fn($n) => !$isDeadline($n)));
    if (count($fb) === 0) {
        $pushTitle = $count === 1 ? "📅 {$dl[0]['project_title']} — {$dl[0]['question']}" : "📅 {$count} échéances";
        $pushBody  = $count === 1 ? (string)$dl[0]['task_title'] : 'À traiter dans Kojima';
        $pushUrl   = '/relances';
    } elseif (count($dl) === 0) {
        $pushTitle = $count === 1 ? "Réponse client — {$fb[0]['project_title']}" : "{$count} nouvelles réponses clients";
        $pushBody  = $count === 1 ? "{$fb[0]['client_name']} : {$fb[0]['response']}" : "{$count} réponses sur " . count($byProject) . " projet(s)";
        $pushUrl   = '/space';
    } else {
        $pushTitle = "{$count} notifications";
        $pushBody  = count($fb) . " réponse(s) client · " . count($dl) . " échéance(s)";
        $pushUrl   = '/home';
    }
    $pushResults = sendPushNotifications($pdo, $pushTitle, $pushBody, $pushUrl);
}

// Mark notifications as sent — only when we actually pushed (not deferred by quiet hours).
if (!$quietNow) {
    $ids          = array_column($pending, 'id');
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $pdo->prepare("UPDATE notifications SET sent = 1, sent_at = NOW() WHERE id IN ({$placeholders})")
        ->execute($ids);
}

ok([
    'sent'      => !$quietNow,
    'count'     => $count,
    'email'     => null,
    'push'      => $pushResults,
    'reminders' => $reminderResults,
    'snooze'    => $snoozeResults,
    'deadlines' => $deadlineResults,
    'pulse'     => $pulseResults,
    'quiet'     => $quietNow,
]);
