<?php
/**
 * Fire one push notification immediately, to every registered subscription.
 *
 * Backs the "Envoyer un test" button in Réglages → Pulse admin. Without it the
 * only way to know whether payment reminders actually reach the phone is to
 * wait for the next morning's pulse, which makes a broken subscription very
 * easy to miss.
 *
 * Deliberately ignores quiet hours: the send is user-initiated, so it should
 * always go out, and the caller needs the result to be meaningful.
 */
require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Method not allowed', 405);
if (!file_exists(__DIR__ . '/push_send.php')) fail('Push sender unavailable', 500);

require_once __DIR__ . '/push_send.php';

ok(sendPushNotifications(
    $pdo,
    'Test Kojima',
    "Si tu vois ceci, les rappels de paiement arrivent bien sur ce téléphone.",
    '/tresorerie'
));
