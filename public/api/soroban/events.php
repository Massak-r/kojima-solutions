<?php
// Bookable-events feed for the Soroban accounting bridge (Kojima → Soroban).
// Emits paid invoices (recettes) + business payables (charges) as documents
// ready for double-entry booking. ENTREPRISE scope only — perso never leaves.
//
// Auth: a valid admin session (operator file export / manual tests) OR a Bearer
// token matching SOROBAN_TOKEN (Soroban's server-to-server pull). Financial
// data — never open. File mode (v1) works with the admin session, no secret.
require_once __DIR__ . '/../_bootstrap.php';

function bridgeAuthed(): bool {
    if (validateAdminSession() !== null) return true;
    $hdr = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if ($hdr === '' && function_exists('getallheaders')) {
        foreach (getallheaders() as $k => $v) {
            if (strcasecmp($k, 'Authorization') === 0) { $hdr = $v; break; }
        }
    }
    return defined('SOROBAN_TOKEN') && SOROBAN_TOKEN !== ''
        && preg_match('/^\s*Bearer\s+(\S+)\s*$/i', $hdr, $m)
        && hash_equals(SOROBAN_TOKEN, $m[1]);
}
if (!bridgeAuthed()) fail('Unauthorized', 401);
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') fail('Method not allowed', 405);

// State ledger for the proposed→posted loop (written by acks.php).
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS soroban_postings (
        source_id   VARCHAR(191) NOT NULL PRIMARY KEY,
        status      VARCHAR(24)  NOT NULL,
        ecriture_id VARCHAR(64)  NULL,
        posted_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
} catch (Throwable $e) {}

// Already-resolved events drop out of the feed (Soroban also dedupes via
// source_ref). needs_mapping / error stay, so they retry after a fix.
$resolved = [];
try {
    foreach ($pdo->query("SELECT source_id FROM soroban_postings WHERE status IN ('posted','duplicate','ignored_scope')")->fetchAll() as $r) {
        $resolved[$r['source_id']] = true;
    }
} catch (Throwable $e) {}

$sinceDate = isset($_GET['since']) ? substr(trim((string)$_GET['since']), 0, 10) : null;

/** Replicates src/types/quote.ts totalQuote, in centimes. For the non-assujettie
 *  entity apply_tva is false → TVA 0 → HT = TTC. */
function quoteTotalCents(array $q): int {
    $items = !empty($q['line_items']) ? json_decode($q['line_items'], true) : [];
    $sub = 0.0;
    if (is_array($items)) foreach ($items as $li) {
        $sub += ((float)($li['quantity'] ?? 0)) * ((float)($li['unitPrice'] ?? 0));
    }
    $discount = 0.0;
    if (!empty($q['discount_enabled'])) {
        $val = (float)($q['discount_value'] ?? 0);
        $discount = (($q['discount_type'] ?? 'amount') === 'percent') ? ($sub * $val / 100) : $val;
    }
    $net = max(0.0, $sub - $discount);
    $tva = !empty($q['apply_tva']) ? ($net * 8.1 / 100) : 0.0;
    return (int) round(($net + $tva) * 100);
}

$documents = [];
$cursor = $sinceDate ?? '';
$bump = function (?string $ts) use (&$cursor) { if ($ts && $ts > $cursor) $cursor = $ts; };

// ── Recettes: invoices marked paid. amount = total facturé = total encaissé. ──
try {
    $sql = "SELECT * FROM quotes WHERE doc_type = 'invoice' AND invoice_status = 'paid' AND COALESCE(is_template,0) = 0";
    if ($sinceDate) $sql .= " AND (paid_at IS NULL OR DATE(paid_at) >= " . $pdo->quote($sinceDate) . ")";
    foreach ($pdo->query($sql)->fetchAll() as $q) {
        $sid = 'invoice:' . $q['id'];
        if (isset($resolved[$sid])) continue;
        $amt = quoteTotalCents($q);
        if ($amt <= 0) continue;
        $paidAt = !empty($q['paid_at']) ? substr((string)$q['paid_at'], 0, 10) : null;
        $label  = trim(($q['quote_number'] ?? '') . ' · ' . ($q['project_title'] ?? ''), " ·");
        $documents[] = array_filter([
            'type'          => 'invoice_paid',
            'sourceId'      => $sid,
            'amountCents'   => $amt,
            'currency'      => 'CHF',
            'scope'         => 'entreprise',
            'direction'     => 'in',
            'date'          => $q['validity_date'] ?: ($paidAt ?: substr((string)$q['created_at'], 0, 10)),
            'paidAt'        => $paidAt,
            'paymentStatus' => 'paid',
            'label'         => $label !== '' ? $label : ($q['quote_number'] ?? 'Facture'),
            'counterparty'  => $q['client_name'] ?? '',
        ], fn($v) => $v !== null && $v !== '');
        $bump($paidAt);
    }
} catch (Throwable $e) {}

// ── Charges: business payables (out, not cancelled) on an ENTREPRISE account. ──
$scopeCache = [];
try {
    $sql = "SELECT * FROM payables WHERE direction = 'out' AND status <> 'cancelled'";
    if ($sinceDate) $sql .= " AND DATE(updated_at) >= " . $pdo->quote($sinceDate);
    foreach ($pdo->query($sql)->fetchAll() as $p) {
        $sid = 'payable:' . $p['id'];
        if (isset($resolved[$sid])) continue;
        $accId = $p['account_id'] ?? null;
        if (!$accId) continue; // no account → scope unknown → don't leak
        if (!array_key_exists($accId, $scopeCache)) {
            $scopeCache[$accId] = null;
            try { $s = $pdo->prepare('SELECT type FROM accounts WHERE id = ?'); $s->execute([$accId]); $row = $s->fetch(); if ($row) $scopeCache[$accId] = $row['type'] ?? null; } catch (Throwable $e) {}
        }
        if ($scopeCache[$accId] !== 'entreprise') continue; // only explicit entreprise leaves
        $amt = (int) round(((float)$p['amount']) * 100);
        if ($amt <= 0) continue;
        $paidAt = !empty($p['paid_at']) ? substr((string)$p['paid_at'], 0, 10) : null;
        $documents[] = array_filter([
            'type'            => 'expense',
            'sourceId'        => $sid,
            'amountCents'     => $amt,
            'currency'        => $p['currency'] ?? 'CHF',
            'scope'           => 'entreprise',
            'direction'       => 'out',
            'date'            => $p['due_date'] ?: substr((string)$p['created_at'], 0, 10),
            'paidAt'          => $paidAt,
            'category'        => $p['category'] ?? null,
            'kojimaAccountId' => $accId,
            'label'           => $p['label'] ?? '',
            'paymentStatus'   => ($p['status'] === 'paid') ? 'paid' : null,
        ], fn($v) => $v !== null && $v !== '');
        $bump(!empty($p['updated_at']) ? substr((string)$p['updated_at'], 0, 10) : null);
    }
} catch (Throwable $e) {}

ok([
    'protocol'     => 'kojima-soroban-bridge',
    'version'      => '1.0',
    'feed'         => 'bookable-events',
    'generated_at' => gmdate('Y-m-d\TH:i:s\Z'),
    'source'       => ['system' => 'kojima'],
    'cursor'       => $cursor,
    'documents'    => array_values($documents),
]);
