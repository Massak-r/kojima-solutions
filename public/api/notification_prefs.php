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
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

// Auto-migration (2026-08-14): the lead time used to be hardcoded to 3 days in
// digest.php, which is far too late for an invoice that needs a transfer.
try {
    $cols = $pdo->query('SHOW COLUMNS FROM notification_prefs')->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('pulse_lead_days', $cols)) {
        $pdo->exec("ALTER TABLE notification_prefs ADD COLUMN pulse_lead_days TINYINT NOT NULL DEFAULT 3");
    }
} catch (Throwable $e) {}

function loadPrefs(PDO $pdo): array {
    $row = $pdo->query("SELECT admin_pulse_enabled, pulse_hour, quiet_start, quiet_end, pulse_lead_days FROM notification_prefs WHERE id = 1")->fetch();
    if (!$row) $row = ['admin_pulse_enabled' => 1, 'pulse_hour' => 8, 'quiet_start' => 21, 'quiet_end' => 8, 'pulse_lead_days' => 3];
    return [
        'adminPulseEnabled' => (bool)$row['admin_pulse_enabled'],
        'pulseHour'  => (int)$row['pulse_hour'],
        'quietStart' => (int)$row['quiet_start'],
        'quietEnd'   => (int)$row['quiet_end'],
        'pulseLeadDays' => (int)($row['pulse_lead_days'] ?? 3),
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
    $pdo->prepare("INSERT INTO notification_prefs (id, admin_pulse_enabled, pulse_hour, quiet_start, quiet_end, pulse_lead_days)
                   VALUES (1, ?, ?, ?, ?, ?)
                   ON DUPLICATE KEY UPDATE admin_pulse_enabled = VALUES(admin_pulse_enabled),
                       pulse_hour = VALUES(pulse_hour), quiet_start = VALUES(quiet_start),
                       quiet_end = VALUES(quiet_end), pulse_lead_days = VALUES(pulse_lead_days),
                       updated_at = NOW()")
        ->execute([$enabled, $pulseHour, $quietStart, $quietEnd, $lead]);
    ok(loadPrefs($pdo));
} else {
    fail('Method not allowed', 405);
}
