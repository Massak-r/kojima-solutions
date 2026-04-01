<?php
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/_client_email.php';
requireAuth();

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') {
    fail('Method not allowed', 405);
}

$body = body();
$quoteId     = trim($body['quoteId']     ?? '');
$clientEmail = trim($body['clientEmail'] ?? '');
$clientName  = trim($body['clientName']  ?? '');
$quoteNumber = trim($body['quoteNumber'] ?? '');
$amount      = trim($body['amount']      ?? '');

if (!$quoteId || !$clientEmail) {
    fail('quoteId and clientEmail are required');
}

if (!filter_var($clientEmail, FILTER_VALIDATE_EMAIL)) {
    fail('Invalid email address');
}

$subject = "Rappel - Facture $quoteNumber";

$emailBody = "Bonjour $clientName,\n\n"
    . "Un petit rappel concernant la facture $quoteNumber d'un montant de CHF $amount.\n\n"
    . "Si le paiement a déjà été effectué, veuillez ignorer ce message.\n\n"
    . "Cordialement,\nKojima Solutions";

$sent = sendClientEmail($clientEmail, $subject, $emailBody);

if (!$sent) {
    fail('Failed to send reminder email', 500);
}

ok(['sent' => true, 'sentAt' => date('c')]);
