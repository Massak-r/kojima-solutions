<?php
// Notification preferences (single-admin → one row, id=1). Governs the daily
// admin pulse + quiet hours, both consumed by digest.php (the cron).
require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

$pdo->exec("CREATE TABLE IF NOT EXISTS notification_prefs (
    id TINYINT NOT NULL PRIMARY KEY DEFAULT 1,
    admin_pulse_enabled TINYINT NOT NULL DEFAULT 1,
    pulse_hour TINYINT NOT NULL DEFAULT 8,
    quiet_start TINYINT NOT NULL DEFAULT 21,
    quiet_end TINYINT NOT NULL DEFAULT 8,
    pulse_lead_days TINYINT NOT NULL DEFAULT 3,
    pulse_style VARCHAR(16) NOT NULL DEFAULT 'digest',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

// Auto-migrations. (2026-08-14) the lead time used to be hardcoded to 3 days in
// digest.php, which is far too late for an invoice that needs a transfer.
// (2026-08-18) pulse_style chooses between one grouped push and one per item.
try {
    $cols = $pdo->query('SHOW COLUMNS FROM notification_prefs')->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('pulse_lead_days', $cols)) {
        $pdo->exec("ALTER TABLE notification_prefs ADD COLUMN pulse_lead_days TINYINT NOT NULL DEFAULT 3");
    }
    if (!in_array('pulse_style', $cols)) {
        $pdo->exec("ALTER TABLE notification_prefs ADD COLUMN pulse_style VARCHAR(16) NOT NULL DEFAULT 'digest'");
    }
    // (2026-08-19) alertes de paiement dédiées : les grosses sorties sortent du
    // pulse et reçoivent leur propre notification, à J-lead puis le jour même.
    if (!in_array('payment_alert_enabled', $cols)) {
        $pdo->exec("ALTER TABLE notification_prefs ADD COLUMN payment_alert_enabled TINYINT NOT NULL DEFAULT 1");
    }
    if (!in_array('payment_alert_min_amount', $cols)) {
        $pdo->exec("ALTER TABLE notification_prefs ADD COLUMN payment_alert_min_amount INT NOT NULL DEFAULT 300");
    }
    if (!in_array('payment_alert_lead_days', $cols)) {
        $pdo->exec("ALTER TABLE notification_prefs ADD COLUMN payment_alert_lead_days TINYINT NOT NULL DEFAULT 7");
    }
} catch (Throwable $e) {}

function loadPrefs(PDO $pdo): array {
    $defaults = [
        'admin_pulse_enabled' => 1, 'pulse_hour' => 8, 'quiet_start' => 21, 'quiet_end' => 8,
        'pulse_lead_days' => 3, 'pulse_style' => 'digest',
        'payment_alert_enabled' => 1, 'payment_alert_min_amount' => 300, 'payment_alert_lead_days' => 7,
    ];
    $row = $pdo->query("SELECT * FROM notification_prefs WHERE id = 1")->fetch();
    $row = $row ? array_merge($defaults, array_intersect_key($row, $defaults)) : $defaults;
    return [
        'adminPulseEnabled' => (bool)$row['admin_pulse_enabled'],
        'pulseHour'  => (int)$row['pulse_hour'],
        'quietStart' => (int)$row['quiet_start'],
        'quietEnd'   => (int)$row['quiet_end'],
        'pulseLeadDays' => (int)($row['pulse_lead_days'] ?? 3),
        'pulseStyle' => ($row['pulse_style'] ?? 'digest') === 'per_task' ? 'per_task' : 'digest',
        'paymentAlertEnabled'   => (bool)($row['payment_alert_enabled'] ?? 1),
        'paymentAlertMinAmount' => (int)($row['payment_alert_min_amount'] ?? 300),
        'paymentAlertLeadDays'  => (int)($row['payment_alert_lead_days'] ?? 7),
    ];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    ok(loadPrefs($pdo));
} elseif ($method === 'PUT') {
    $d   = body();
    $cur = loadPrefs($pdo);
    $clamp = fn($v, $def) => is_numeric($v) ? max(0, min(23, (int)$v)) : $def;
    $enabled    = array_key_exists('adminPulseEnabled', $d) ? (int)(bool)$d['adminPulseEnabled'] : (int)$cur['adminPulseEnabled'];
    $pulseHour  = array_key_exists('pulseHour', $d)  ? $clamp($d['pulseHour'],  $cur['pulseHour'])  : $cur['pulseHour'];
    $quietStart = array_key_exists('quietStart', $d) ? $clamp($d['quietStart'], $cur['quietStart']) : $cur['quietStart'];
    $quietEnd   = array_key_exists('quietEnd', $d)   ? $clamp($d['quietEnd'],   $cur['quietEnd'])   : $cur['quietEnd'];
    $lead       = array_key_exists('pulseLeadDays', $d) && is_numeric($d['pulseLeadDays'])
        ? max(1, min(30, (int)$d['pulseLeadDays']))
        : $cur['pulseLeadDays'];
    $style      = array_key_exists('pulseStyle', $d)
        ? ($d['pulseStyle'] === 'per_task' ? 'per_task' : 'digest')
        : $cur['pulseStyle'];
    $payOn      = array_key_exists('paymentAlertEnabled', $d) ? (int)(bool)$d['paymentAlertEnabled'] : (int)$cur['paymentAlertEnabled'];
    // Seuil borné à 100'000 : au-delà on ne filtre plus rien, on éteint. Le 0 est
    // permis et veut dire « toutes les sorties engagées », ce qui est un choix,
    // pas une erreur de saisie.
    $payMin     = array_key_exists('paymentAlertMinAmount', $d) && is_numeric($d['paymentAlertMinAmount'])
        ? max(0, min(100000, (int)$d['paymentAlertMinAmount']))
        : $cur['paymentAlertMinAmount'];
    $payLead    = array_key_exists('paymentAlertLeadDays', $d) && is_numeric($d['paymentAlertLeadDays'])
        ? max(1, min(60, (int)$d['paymentAlertLeadDays']))
        : $cur['paymentAlertLeadDays'];
    $pdo->prepare("INSERT INTO notification_prefs (id, admin_pulse_enabled, pulse_hour, quiet_start, quiet_end, pulse_lead_days, pulse_style, payment_alert_enabled, payment_alert_min_amount, payment_alert_lead_days)
                   VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON DUPLICATE KEY UPDATE admin_pulse_enabled = VALUES(admin_pulse_enabled),
                       pulse_hour = VALUES(pulse_hour), quiet_start = VALUES(quiet_start),
                       quiet_end = VALUES(quiet_end), pulse_lead_days = VALUES(pulse_lead_days),
                       pulse_style = VALUES(pulse_style),
                       payment_alert_enabled = VALUES(payment_alert_enabled),
                       payment_alert_min_amount = VALUES(payment_alert_min_amount),
                       payment_alert_lead_days = VALUES(payment_alert_lead_days),
                       updated_at = NOW()")
        ->execute([$enabled, $pulseHour, $quietStart, $quietEnd, $lead, $style, $payOn, $payMin, $payLead]);
    ok(loadPrefs($pdo));
} else {
    fail('Method not allowed', 405);
}
