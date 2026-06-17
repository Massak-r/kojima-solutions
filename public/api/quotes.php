<?php
require_once __DIR__ . '/_bootstrap.php';
requireAuthForWrites();

// Auto-migrate: add payment_terms / template columns if missing (same pattern as client_address).
try {
    $cols = array_column($pdo->query('SHOW COLUMNS FROM quotes')->fetchAll(), 'Field');
    if (!in_array('payment_terms', $cols)) {
        $pdo->exec('ALTER TABLE quotes ADD COLUMN payment_terms TEXT DEFAULT NULL');
    }
    if (!in_array('is_template', $cols)) {
        $pdo->exec('ALTER TABLE quotes ADD COLUMN is_template TINYINT(1) NOT NULL DEFAULT 0');
    }
    if (!in_array('template_name', $cols)) {
        $pdo->exec('ALTER TABLE quotes ADD COLUMN template_name VARCHAR(255) DEFAULT NULL');
    }
    if (!in_array('source_quote_id', $cols)) {
        $pdo->exec('ALTER TABLE quotes ADD COLUMN source_quote_id VARCHAR(36) DEFAULT NULL');
    }
    if (!in_array('billing_kind', $cols)) {
        $pdo->exec('ALTER TABLE quotes ADD COLUMN billing_kind VARCHAR(16) DEFAULT NULL');
    }
    if (!in_array('billed_pct', $cols)) {
        $pdo->exec('ALTER TABLE quotes ADD COLUMN billed_pct DECIMAL(6,2) DEFAULT NULL');
    }
    if (!in_array('client_ref', $cols)) {
        $pdo->exec('ALTER TABLE quotes ADD COLUMN client_ref VARCHAR(128) DEFAULT NULL');
    }
} catch (Throwable $e) {}

// ── Helper ──────────────────────────────────────────────────

function mapQuote(array $row): array {
    return [
        'id'                 => $row['id'],
        'projectId'          => $row['project_id'] ?? null,
        'lang'               => $row['lang'],
        'quoteNumber'        => $row['quote_number'],
        'validityDate'       => $row['validity_date'] ?? '',
        'projectTitle'       => $row['project_title'] ?? '',
        'projectDescription' => $row['project_desc'] ?? '',
        'conditions'         => $row['conditions'] ?? '',
        'clientName'         => $row['client_name'] ?? '',
        'clientEmail'        => $row['client_email'] ?? '',
        'clientCompany'      => $row['client_company'] ?? '',
        'clientAddress'      => $row['client_address'] ?? '',
        'clientRef'          => $row['client_ref'] ?? '',
        'paymentTerms'       => $row['payment_terms'] ?? '',
        'lineItems'          => $row['line_items'] ? json_decode($row['line_items'], true) : [],
        'applyTva'           => (bool)$row['apply_tva'],
        'discountEnabled'    => (bool)$row['discount_enabled'],
        'discountType'       => $row['discount_type'],
        'discountValue'      => (float)$row['discount_value'],
        'discountLabel'      => $row['discount_label'] ?? '',
        'docType'            => $row['doc_type'] ?? 'quote',
        'invoiceStatus'      => $row['invoice_status'] ?? 'draft',
        'isTemplate'         => (bool)($row['is_template'] ?? 0),
        'templateName'       => $row['template_name'] ?? null,
        'sourceQuoteId'      => $row['source_quote_id'] ?? null,
        'billingKind'        => $row['billing_kind'] ?? null,
        'billedPct'          => isset($row['billed_pct']) && $row['billed_pct'] !== null ? (float)$row['billed_pct'] : null,
        'createdAt'          => $row['created_at'],
    ];
}

$method    = $_SERVER['REQUEST_METHOD'];
$id        = $_GET['id']         ?? null;
$projectId = $_GET['project_id'] ?? null;

// ── GET ─────────────────────────────────────────────────────

if ($method === 'GET') {
    if ($id) {
        $stmt = $pdo->prepare('SELECT * FROM quotes WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) fail('Quote not found', 404);
        ok(mapQuote($row));
    } elseif ($projectId) {
        $stmt = $pdo->prepare('SELECT * FROM quotes WHERE project_id = ? ORDER BY created_at DESC');
        $stmt->execute([$projectId]);
        ok(array_map('mapQuote', $stmt->fetchAll()));
    } else {
        $rows = $pdo->query('SELECT * FROM quotes ORDER BY created_at DESC')->fetchAll();
        ok(array_map('mapQuote', $rows));
    }
}

// ── POST — create ────────────────────────────────────────────

if ($method === 'POST') {
    $data  = body();
    $newId = !empty($data['id']) ? $data['id'] : uuid();
    $pdo->prepare('
        INSERT INTO quotes (id, project_id, lang, doc_type, invoice_status, quote_number, validity_date, project_title,
            project_desc, conditions, client_name, client_email, client_company, client_address, payment_terms,
            line_items, apply_tva, discount_enabled, discount_type, discount_value, discount_label,
            is_template, template_name, source_quote_id, billing_kind, billed_pct, client_ref)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ')->execute([
        $newId,
        $data['projectId']          ?? null,
        $data['lang']               ?? 'fr',
        $data['docType']            ?? 'quote',
        $data['invoiceStatus']      ?? 'draft',
        $data['quoteNumber']        ?? '',
        ($data['validityDate'] ?? '') ?: null,
        $data['projectTitle']       ?? null,
        $data['projectDescription'] ?? null,
        $data['conditions']         ?? null,
        $data['clientName']         ?? null,
        $data['clientEmail']        ?? null,
        $data['clientCompany']      ?? null,
        $data['clientAddress']      ?? null,
        $data['paymentTerms']       ?? null,
        json_encode($data['lineItems'] ?? []),
        (int)($data['applyTva']        ?? false),
        (int)($data['discountEnabled'] ?? false),
        $data['discountType']       ?? 'amount',
        (float)($data['discountValue'] ?? 0),
        $data['discountLabel']      ?? null,
        (int)($data['isTemplate']     ?? false),
        $data['templateName']       ?? null,
        $data['sourceQuoteId']      ?? null,
        $data['billingKind']        ?? null,
        isset($data['billedPct']) && $data['billedPct'] !== null ? (float)$data['billedPct'] : null,
        $data['clientRef']          ?? null,
    ]);
    $stmt = $pdo->prepare('SELECT * FROM quotes WHERE id = ?');
    $stmt->execute([$newId]);
    ok(mapQuote($stmt->fetch()));
}

// ── PUT — update ─────────────────────────────────────────────

if ($method === 'PUT') {
    if (!$id) fail('Missing id');
    $data = body();
    $pdo->prepare('
        UPDATE quotes SET
            project_id = ?, lang = ?, doc_type = ?, invoice_status = ?, quote_number = ?, validity_date = ?,
            project_title = ?, project_desc = ?, conditions = ?,
            client_name = ?, client_email = ?, client_company = ?, client_address = ?, payment_terms = ?,
            line_items = ?, apply_tva = ?, discount_enabled = ?,
            discount_type = ?, discount_value = ?, discount_label = ?,
            is_template = ?, template_name = ?,
            source_quote_id = ?, billing_kind = ?, billed_pct = ?, client_ref = ?
        WHERE id = ?
    ')->execute([
        $data['projectId']          ?? null,
        $data['lang']               ?? 'fr',
        $data['docType']            ?? 'quote',
        $data['invoiceStatus']      ?? 'draft',
        $data['quoteNumber']        ?? '',
        ($data['validityDate'] ?? '') ?: null,
        $data['projectTitle']       ?? null,
        $data['projectDescription'] ?? null,
        $data['conditions']         ?? null,
        $data['clientName']         ?? null,
        $data['clientEmail']        ?? null,
        $data['clientCompany']      ?? null,
        $data['clientAddress']      ?? null,
        $data['paymentTerms']       ?? null,
        json_encode($data['lineItems'] ?? []),
        (int)($data['applyTva']        ?? false),
        (int)($data['discountEnabled'] ?? false),
        $data['discountType']       ?? 'amount',
        (float)($data['discountValue'] ?? 0),
        $data['discountLabel']      ?? null,
        (int)($data['isTemplate']     ?? false),
        $data['templateName']       ?? null,
        $data['sourceQuoteId']      ?? null,
        $data['billingKind']        ?? null,
        isset($data['billedPct']) && $data['billedPct'] !== null ? (float)$data['billedPct'] : null,
        $data['clientRef']          ?? null,
        $id,
    ]);
    $stmt = $pdo->prepare('SELECT * FROM quotes WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) fail('Quote not found', 404);
    ok(mapQuote($row));
}

// ── DELETE ──────────────────────────────────────────────────

if ($method === 'DELETE') {
    if (!$id) fail('Missing id');
    $pdo->prepare('DELETE FROM quotes WHERE id = ?')->execute([$id]);
    ok();
}
