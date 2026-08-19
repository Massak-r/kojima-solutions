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

// ── Dry run: compose tomorrow's pulse without sending or claiming ─────
// A pulse can only be observed once a day, at 8am, on a phone — a terrible loop
// for checking that it says something useful. `?preview=pulse` returns exactly
// what would be pushed, ignoring quiet hours and the once-a-day claim, and sends
// nothing. Admin-only: the cron endpoint itself is open, and the body of a pulse
// is the list of everything you owe.
$previewPulse = (($_GET['preview'] ?? '') === 'pulse');
if ($previewPulse) requireAdminSession();

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

// ── Alertes de paiement dédiées ──────────────────────────────
// Le pulse quotidien met tout sur le même plan : une facture d'électricité de
// 25 CHF y voisine avec un acompte d'impôts de 3 000 CHF, et le plafond de cinq
// items peut évincer le second. Une grosse sortie mérite sa propre notification,
// à son propre rythme : une à J-lead pour préparer le virement, une le jour même.
//
// Ces alertes vivent dans push_reminders — donc dans Réglages → Rappels, listées
// et supprimables une par une — et se retirent toutes seules dès que la ligne
// passe en payé ou annulé. Aucun nouvel étage : la provenance (source_type,
// source_id, source_slot) suffit à les reconnaître et à les réconcilier.
//
// Règle qui évite le pire : on ne rattrape jamais le passé. Un créneau déjà
// écoulé au moment de la synchro ne déclenche rien. Sans ça, activer la fonction
// un matin ferait tomber dix notifications d'un coup, ce qui n'apprend qu'une
// chose : les balayer sans les lire.
$payAlertResults = ['created' => 0, 'cancelled' => 0];
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS deadline_alerts (
        alert_key VARCHAR(191) NOT NULL PRIMARY KEY, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS push_reminders (
        id VARCHAR(36) PRIMARY KEY, title VARCHAR(255) NOT NULL, body TEXT NULL,
        url VARCHAR(512) NOT NULL DEFAULT '/home', scheduled_at DATETIME NOT NULL,
        sent_at DATETIME NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_due (sent_at, scheduled_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    // Créée ici aussi : le bloc pulse plus bas la crée déjà, mais il s'exécute
    // après, et les préférences seraient ignorées au tout premier passage.
    $pdo->exec("CREATE TABLE IF NOT EXISTS notification_prefs (
        id TINYINT NOT NULL PRIMARY KEY DEFAULT 1,
        admin_pulse_enabled TINYINT NOT NULL DEFAULT 1,
        pulse_hour TINYINT NOT NULL DEFAULT 8,
        quiet_start TINYINT NOT NULL DEFAULT 21,
        quiet_end TINYINT NOT NULL DEFAULT 8,
        pulse_lead_days TINYINT NOT NULL DEFAULT 3,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    foreach ([
        "ALTER TABLE push_reminders ADD COLUMN source_type VARCHAR(32) NULL",
        "ALTER TABLE push_reminders ADD COLUMN source_id VARCHAR(36) NULL",
        "ALTER TABLE push_reminders ADD COLUMN source_slot VARCHAR(16) NULL",
        "CREATE UNIQUE INDEX uniq_reminder_source ON push_reminders (source_type, source_id, source_slot)",
        "ALTER TABLE notification_prefs ADD COLUMN payment_alert_enabled TINYINT NOT NULL DEFAULT 1",
        "ALTER TABLE notification_prefs ADD COLUMN payment_alert_min_amount INT NOT NULL DEFAULT 300",
        "ALTER TABLE notification_prefs ADD COLUMN payment_alert_lead_days TINYINT NOT NULL DEFAULT 7",
    ] as $ddl) { try { $pdo->exec($ddl); } catch (Throwable $e) { /* déjà en place */ } }

    $pa = ['payment_alert_enabled' => 1, 'payment_alert_min_amount' => 300, 'payment_alert_lead_days' => 7];
    try {
        $row = $pdo->query("SELECT * FROM notification_prefs WHERE id = 1")->fetch();
        if ($row) $pa = array_merge($pa, array_intersect_key($row, $pa));
    } catch (Throwable $e) {}

    $tz    = new DateTimeZone('Europe/Zurich');
    $now   = new DateTime('now', $tz);
    $utc   = function (DateTime $d): string { $c = clone $d; $c->setTimezone(new DateTimeZone('UTC')); return $c->format('Y-m-d H:i:s'); };
    // 09:00 et non 08:00 : à la même heure que le pulse, une alerte dédiée arrive
    // dans le même lot et se fait balayer avec lui. Une heure plus tard, elle est
    // seule sur l'écran — c'est tout l'intérêt de l'avoir sortie du pulse.
    $slot  = function (string $date, int $minusDays) use ($tz): DateTime {
        $d = new DateTime($date . ' 09:00:00', $tz);
        if ($minusDays > 0) $d->modify('-' . $minusDays . ' days');
        return $d;
    };
    $short = fn(string $s) => mb_strlen($s) > 60 ? mb_substr($s, 0, 57) . '…' : $s;

    // Une même obligation existe souvent deux fois : la sortie d'argent dans la
    // trésorerie et l'échéance dans le Centre admin. Sans rapprochement, l'OCAS
    // envoie quatre notifications pour une seule chose à faire — le meilleur
    // moyen d'apprendre à les ignorer. On compare le libellé nettoyé à date
    // d'échéance égale : c'est assez strict pour ne pas fusionner deux
    // obligations distinctes, assez souple pour reconnaître « OCAS - cotisations
    // sociales 2025 » et « OCAS - cotisations sociales 2025 (1 146 CHF) ».
    $norm = function (string $s): string {
        $s = mb_strtolower($s);
        $s = preg_replace('/\([^)]*\)/u', ' ', $s);
        $s = preg_replace('/[^\p{L}\p{N}]+/u', ' ', $s);
        return trim(preg_replace('/\s+/u', ' ', $s));
    };
    $payableByDue = [];   // 'YYYY-MM-DD' => [libellés normalisés]

    // Horizon : au-delà, l'alerte n'aide personne et transforme la liste des
    // rappels en mur. Une échéance lointaine y entrera d'elle-même le jour où
    // elle passe la barre — la synchro tourne toutes les heures.
    $horizon = (clone $now)->modify('+120 days')->format('Y-m-d');

    $wanted = [];   // "type:id:slot" => [title, body, url, at]

    if ((int)$pa['payment_alert_enabled'] === 1) {
        $minAmount = max(0, (int)$pa['payment_alert_min_amount']);
        $lead      = max(1, min(60, (int)$pa['payment_alert_lead_days']));

        // (a) Sorties engagées avec une échéance et un montant qui compte.
        // Les forecast restent dehors : une projection ne se paie pas.
        try {
            $st = $pdo->prepare("SELECT id, label, amount, currency, due_date FROM payables
                                 WHERE direction = 'out' AND status IN ('pending','scheduled')
                                   AND commitment = 'committed' AND due_date IS NOT NULL
                                   AND amount >= ?");
            $st->execute([$minAmount]);
            foreach ($st->fetchAll() as $p) {
                $due  = substr((string)$p['due_date'], 0, 10);
                if ($due > $horizon) continue;
                $cur  = $p['currency'] ?: 'CHF';
                $amt  = number_format((float)$p['amount'], 2, '.', "'");
                $amt  = str_ends_with($amt, '.00') ? substr($amt, 0, -3) : $amt;
                $lbl  = $short((string)$p['label']);
                $when = (new DateTime($due))->format('d.m');
                $payableByDue[$due][] = $norm((string)$p['label']);
                $wanted['payable:' . $p['id'] . ':lead'] = [
                    'title' => "À préparer : $lbl - $amt $cur le $when",
                    'body'  => 'Virement à anticiper.',
                    'url'   => '/tresorerie',
                    'at'    => $slot($due, $lead),
                ];
                $wanted['payable:' . $p['id'] . ':due'] = [
                    'title' => "À payer aujourd'hui : $lbl - $amt $cur",
                    'body'  => "Échéance du $when.",
                    'url'   => '/tresorerie',
                    'at'    => $slot($due, 0),
                ];
            }
        } catch (Throwable $e) {}

        // (b) Échéances admin non terminées. Leur fenêtre d'alerte est déjà dans
        // la donnée (remind_days) : on la respecte au lieu d'imposer la nôtre.
        try {
            foreach ($pdo->query("SELECT id, title, due_date, remind_days FROM admin_deadlines WHERE completed = 0")->fetchAll() as $d) {
                $due  = substr((string)$d['due_date'], 0, 10);
                if ($due > $horizon) continue;
                $nt   = $norm((string)$d['title']);
                $seen = false;
                foreach ($payableByDue[$due] ?? [] as $np) {
                    if ($np !== '' && ($np === $nt || str_contains($nt, $np) || str_contains($np, $nt))) { $seen = true; break; }
                }
                if ($seen) continue;   // la trésorerie porte déjà le montant, elle gagne
                $rd   = max(1, min(90, (int)$d['remind_days']));
                $lbl  = $short((string)$d['title']);
                $when = (new DateTime($due))->format('d.m');
                $wanted['deadline:' . $d['id'] . ':lead'] = [
                    'title' => "À préparer : $lbl - échéance le $when",
                    'body'  => "Dans $rd jours.",
                    'url'   => '/admin',
                    'at'    => $slot($due, $rd),
                ];
                $wanted['deadline:' . $d['id'] . ':due'] = [
                    'title' => "Échéance aujourd'hui : $lbl",
                    'body'  => 'Dernier jour.',
                    'url'   => '/admin',
                    'at'    => $slot($due, 0),
                ];
            }
        } catch (Throwable $e) {}
    }

    // Pas de rattrapage, et pas de résurrection de ce qui a été écarté à la main.
    foreach ($wanted as $k => $w) { if ($w['at'] <= $now) unset($wanted[$k]); }
    try {
        foreach ($pdo->query("SELECT alert_key FROM deadline_alerts WHERE alert_key LIKE 'payalert_off:%'")->fetchAll(PDO::FETCH_COLUMN) as $key) {
            unset($wanted[substr($key, 13)]);
        }
    } catch (Throwable $e) {}

    // Réconciliation : ce qui n'est plus voulu (réglé, annulé, date déplacée)
    // disparaît, ce qui manque est posé. Les rappels envoyés ne bougent pas.
    $existing = [];
    foreach ($pdo->query("SELECT id, source_type, source_id, source_slot, scheduled_at
                          FROM push_reminders
                          WHERE sent_at IS NULL AND source_type IS NOT NULL")->fetchAll() as $r) {
        $existing[$r['source_type'] . ':' . $r['source_id'] . ':' . $r['source_slot']] = $r;
    }
    $del = $pdo->prepare("DELETE FROM push_reminders WHERE id = ?");
    foreach ($existing as $k => $r) {
        if (isset($wanted[$k]) && $utc($wanted[$k]['at']) === substr((string)$r['scheduled_at'], 0, 19)) continue;
        $del->execute([$r['id']]);
        $payAlertResults['cancelled']++;
        unset($existing[$k]);
    }
    $ins = $pdo->prepare("INSERT IGNORE INTO push_reminders
        (id, title, body, url, scheduled_at, source_type, source_id, source_slot)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    foreach ($wanted as $k => $w) {
        if (isset($existing[$k])) continue;
        [$type, $sid, $sslot] = explode(':', $k, 3);
        $ins->execute([uuid(), mb_substr($w['title'], 0, 255), $w['body'], $w['url'], $utc($w['at']), $type, $sid, $sslot]);
        $payAlertResults['created'] += $ins->rowCount();
    }
} catch (Throwable $e) { $payAlertResults['error'] = $e->getMessage(); }

// ── Scheduled push reminders due now ─────────────────────────
// Fires any reminder whose scheduled_at has passed, reusing the web-push path.
// Runs before the notifications early-return so reminders go out even when
// there's no client feedback pending.
$reminderResults = ['sent' => 0, 'delivered' => 0, 'error' => null];
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
            $res = sendPushNotifications($pdo, $r['title'], (string)($r['body'] ?? ''), $r['url'] ?: '/home');
            // A systemic failure (VAPID unconfigured) must NOT burn the reminder:
            // marking it sent regardless is what hid a completely dead push
            // pipeline behind a reassuring "sent: 1" for months.
            if (!empty($res['error'])) {
                $reminderResults['error'] = $res['error'];
                continue;
            }
            $mark->execute([$r['id']]);
            $reminderResults['sent']++;
            $reminderResults['delivered'] += (int)($res['sent'] ?? 0);
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
        pulse_lead_days TINYINT NOT NULL DEFAULT 3,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS deadline_alerts (
        alert_key VARCHAR(191) NOT NULL PRIMARY KEY, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // 'digest' (one push naming what's next) vs 'per_task' (one push per item).
    // Added here as well as in notification_prefs.php so the cron alone can bring
    // an existing install up to date — it usually runs long before the settings
    // screen is opened.
    try { $pdo->exec("ALTER TABLE notification_prefs ADD COLUMN pulse_style VARCHAR(16) NOT NULL DEFAULT 'digest'"); } catch (Throwable $e) {}

    $prefs = ['admin_pulse_enabled' => 1, 'pulse_hour' => 8, 'quiet_start' => 21, 'quiet_end' => 8, 'pulse_lead_days' => 3, 'pulse_style' => 'digest'];
    $row = $pdo->query("SELECT * FROM notification_prefs WHERE id = 1")->fetch();
    if ($row) $prefs = array_merge($prefs, $row);

    // Local time decisions in the founder's timezone (DST-aware), not server UTC.
    $nowLocal = new DateTime('now', new DateTimeZone('Europe/Zurich'));
    $hour     = (int)$nowLocal->format('G');
    $locDate  = $nowLocal->format('Y-m-d');
    $qs = (int)$prefs['quiet_start']; $qe = (int)$prefs['quiet_end'];
    $quietNow = ($qs === $qe) ? false : (($qs < $qe) ? ($hour >= $qs && $hour < $qe) : ($hour >= $qs || $hour < $qe));

    if ($previewPulse || ((int)$prefs['admin_pulse_enabled'] === 1 && !$quietNow && $hour >= (int)$prefs['pulse_hour'])) {
        $daysTo = fn(string $due) => (int)(new DateTime($locDate))->diff(new DateTime($due))->format('%r%a');
        // How many days ahead an obligation starts being announced. Configurable
        // because 3 days is far too late for anything needing a bank transfer.
        $lead   = max(1, min(30, (int)($prefs['pulse_lead_days'] ?? 3)));
        $items  = []; // [label, days, link, kind]

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
            if ($days <= $lead && $days >= -60) $items[] = ['label' => (string)$s['text'], 'days' => $days, 'link' => '/documents', 'kind' => 'admin'];
        }

        // (b) Payables (pending/scheduled) with a due date, whatever the account.
        // This used to require a.type = 'entreprise', which silently dropped every
        // personal bill — loyer, Serafe, Sunrise, assurances all sit on a 'perso'
        // account or on no account at all — so none of them ever reached the phone.
        // Forecast rows stay out: they are projections, not bills to pay.
        foreach ($pdo->query("SELECT p.label, p.due_date
            FROM payables p
            WHERE p.direction = 'out' AND p.status IN ('pending','scheduled')
              AND p.commitment = 'committed'
              AND p.due_date IS NOT NULL")->fetchAll() as $p) {
            $days = $daysTo(substr((string)$p['due_date'], 0, 10));
            if ($days <= $lead && $days >= -60) $items[] = ['label' => (string)$p['label'], 'days' => $days, 'link' => '/tresorerie', 'kind' => 'money'];
        }

        // (c) Today's sprint — subtasks flagged for today, still open. The pulse
        // read the Sàrl checklist and the payables only, so the one list the app
        // itself calls « aujourd'hui » was the single thing that never reached
        // the phone. Flagged for today means due today: days = 0.
        foreach ($pdo->query("SELECT text FROM todo_subtasks
            WHERE flagged_today = 1 AND completed = 0
            ORDER BY sort_order ASC, created_at ASC")->fetchAll() as $s) {
            $items[] = ['label' => (string)$s['text'], 'days' => 0, 'link' => '/jour', 'kind' => 'sprint'];
        }

        // Silence is a legitimate answer, and the preview has to be able to say so.
        if ($previewPulse && empty($items)) {
            ok([
                'preview'  => true,
                'count'    => 0,
                'title'    => null,
                'body'     => null,
                'lines'    => [],
                'enabled'  => (int)$prefs['admin_pulse_enabled'] === 1,
                'nextHour' => (int)$prefs['pulse_hour'],
            ]);
        }

        if (!empty($items)) {
            // The same obligation can arrive twice (a checklist step that is also
            // flagged for today). Keep the most urgent copy of each.
            $byLabel = [];
            foreach ($items as $it) {
                $k = mb_strtolower(trim($it['label']));
                if (!isset($byLabel[$k]) || $it['days'] < $byLabel[$k]['days']) $byLabel[$k] = $it;
            }
            $items = array_values($byLabel);
            usort($items, fn($a, $b) => $a['days'] <=> $b['days']);

            // Then one domain at a time — aujourd'hui, argent, admin — instead of
            // strict most-overdue-first. Sorted purely by lateness, a CHF 25
            // electricity line that has been overdue for fifty-two days wins every
            // morning and the day's actual work never appears: the fastest way to
            // teach someone to swipe the notification away without reading it.
            $queues = ['sprint' => [], 'money' => [], 'admin' => []];
            foreach ($items as $it) $queues[$it['kind'] ?? 'admin'][] = $it;
            $ordered = [];
            while (array_filter($queues)) {
                foreach ($queues as $k => $q) if ($q) $ordered[] = array_shift($queues[$k]);
            }
            $items = $ordered;

            // One line per obligation, in the app's own language.
            $line = function (array $it): string {
                $label = mb_strlen($it['label']) > 70 ? mb_substr($it['label'], 0, 67) . '…' : $it['label'];
                if ($it['days'] < 0)   return "⚠️ $label — en retard de " . abs($it['days']) . ' j';
                if ($it['days'] === 0) return "$label — aujourd'hui";
                return "$label — dans {$it['days']} j";
            };

            $count   = count($items);
            $perTask = ($prefs['pulse_style'] ?? 'digest') === 'per_task';

            if ($previewPulse) {
                $digestTitle = $count === 1 ? 'Il te reste 1 chose' : "Il te reste $count choses";
                $digestBody  = implode("\n", array_map($line, array_slice($items, 0, 3)));
                if ($count > 3) $digestBody .= "\n+ " . ($count - 3) . ' autre' . ($count - 3 > 1 ? 's' : '');
                ok([
                    'preview'  => true,
                    'style'    => $perTask ? 'per_task' : 'digest',
                    'count'    => $count,
                    'title'    => $perTask ? $line($items[0]) : $digestTitle,
                    'body'     => $perTask ? 'Rappel du jour' : $digestBody,
                    'lines'    => array_map($line, $items),
                    'enabled'  => (int)$prefs['admin_pulse_enabled'] === 1,
                    'nextHour' => (int)$prefs['pulse_hour'],
                ]);
            }

            // Claim once-per-day; only push if we win the claim.
            $claim = $pdo->prepare("INSERT IGNORE INTO deadline_alerts (alert_key) VALUES (?)");
            $claim->execute(['admin_pulse:' . $locDate]);
            if ($claim->rowCount() > 0 && file_exists(__DIR__ . '/push_send.php')) {
                require_once __DIR__ . '/push_send.php';
                $delivered = 0;
                $error     = null;

                if ($perTask) {
                    // One notification per obligation: they stack in the tray and
                    // get dismissed one at a time, which is what "une par tâche"
                    // is for. Capped at five — past that a morning pulse stops
                    // being a list and becomes a wall.
                    foreach (array_slice($items, 0, 5) as $i => $it) {
                        $rest = $count - 5;
                        $sub  = ($rest > 0 && $i === 4) ? "+ $rest autre" . ($rest > 1 ? 's' : '') . ' à voir' : 'Rappel du jour';
                        $res  = sendPushNotifications($pdo, $line($it), $sub, $it['link'] ?? '/jour');
                        if (!empty($res['error'])) { $error = $res['error']; break; }
                        $delivered += (int)($res['sent'] ?? 0);
                    }
                } else {
                    // Finite framing, same language as the app: the countable number
                    // carries the title, and the body names what's next. Three lines
                    // rather than one — naming a single item hid everything behind it,
                    // which is precisely how the day's tasks stayed invisible.
                    $title = $count === 1 ? 'Il te reste 1 chose' : "Il te reste $count choses";
                    $body  = implode("\n", array_map($line, array_slice($items, 0, 3)));
                    if ($count > 3) $body .= "\n+ " . ($count - 3) . ' autre' . ($count - 3 > 1 ? 's' : '');
                    $res       = sendPushNotifications($pdo, $title, $body, $items[0]['link'] ?? '/jour');
                    $error     = $res['error'] ?? null;
                    $delivered = (int)($res['sent'] ?? 0);
                }

                $pulseResults = [
                    'sent'      => $delivered > 0,
                    'delivered' => $delivered,
                    'count'     => $count,
                    'style'     => $perTask ? 'per_task' : 'digest',
                ];
                // Release the once-per-day claim when the send failed systemically,
                // otherwise a misconfiguration silences the pulse until tomorrow and
                // reads exactly like "nothing was due today".
                if ($error) {
                    $pulseResults['error'] = $error;
                    $pdo->prepare("DELETE FROM deadline_alerts WHERE alert_key = ?")
                        ->execute(['admin_pulse:' . $locDate]);
                }
            }
        }
    }
} catch (Throwable $e) { /* best-effort; never break the digest */ }

// ── Fetch all unsent notifications ──────────────────────────
$stmt    = $pdo->query('SELECT * FROM notifications WHERE sent = 0 ORDER BY created_at ASC');
$pending = $stmt->fetchAll();

if (empty($pending)) {
    ok(['sent' => false, 'reason' => 'No pending notifications', 'reminders' => $reminderResults, 'snooze' => $snoozeResults, 'deadlines' => $deadlineResults, 'pulse' => $pulseResults, 'payAlerts' => $payAlertResults]);
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
