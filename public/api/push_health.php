<?php
/**
 * Push pipeline health — read-only.
 *
 * "When did the last push actually go out?" was unanswerable: the daily pulse
 * left only a once-per-day claim in deadline_alerts, scheduled reminders kept a
 * sent_at, and an outright delivery failure left nothing at all. Three partial
 * traces, none of them visible from the app. This reads them back in one shot so
 * Réglages → Pulse admin can state the date plainly instead of the user having
 * to infer it from whether their phone buzzed.
 *
 * GET /api/push_health.php
 */
require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') fail('Method not allowed', 405);

$out = [
    'vapidConfigured' => defined('VAPID_PUBLIC_KEY') && defined('VAPID_PRIVATE_KEY'),
    'subscriptions'   => 0,
    'lastPush'        => null,
    'recent'          => [],
    'pulseDays'       => [],
    'lastReminder'    => null,
];

// Devices currently listening. Zero here is the whole explanation whenever
// nothing arrives, and it is invisible everywhere else.
try {
    $out['subscriptions'] = (int)$pdo->query('SELECT COUNT(*) c FROM push_subscriptions')->fetch()['c'];
} catch (Throwable $e) {}

// Every send, whatever fired it (pulse, reminder, deadline, manual test).
try {
    $rows = $pdo->query("SELECT title, body, url, sent, failed, expired, codes, created_at
                         FROM push_log ORDER BY created_at DESC LIMIT 20")->fetchAll();
    $out['recent'] = array_map(fn($r) => [
        'title'     => $r['title'],
        'body'      => $r['body'],
        'url'       => $r['url'],
        'sent'      => (int)$r['sent'],
        'failed'    => (int)$r['failed'],
        'expired'   => (int)$r['expired'],
        'createdAt' => $r['created_at'],
    ], $rows);
    $out['lastPush'] = $out['recent'][0] ?? null;
} catch (Throwable $e) { /* table appears on the first send after this deploy */ }

// The daily pulse's own ledger — one row per day it fired. Predates push_log,
// so it still carries the only history for everything before this deploy.
try {
    $rows = $pdo->query("SELECT alert_key, created_at FROM deadline_alerts
                         WHERE alert_key LIKE 'admin_pulse:%'
                         ORDER BY created_at DESC LIMIT 21")->fetchAll();
    $out['pulseDays'] = array_map(fn($r) => [
        'date'    => substr((string)$r['alert_key'], strlen('admin_pulse:')),
        'firedAt' => $r['created_at'],
    ], $rows);
} catch (Throwable $e) {}

// Most recent scheduled reminder that actually went out.
try {
    $r = $pdo->query("SELECT title, scheduled_at, sent_at FROM push_reminders
                      WHERE sent_at IS NOT NULL ORDER BY sent_at DESC LIMIT 1")->fetch();
    if ($r) $out['lastReminder'] = ['title' => $r['title'], 'scheduledAt' => $r['scheduled_at'], 'sentAt' => $r['sent_at']];
} catch (Throwable $e) {}

ok($out);
