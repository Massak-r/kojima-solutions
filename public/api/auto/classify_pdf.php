<?php
// Phase 2a — Return PDF metadata + extracted text so Claude (MCP) can classify.
// Claude reads the output, suggests title/category/tags, then calls update_admin_doc.
// GET /api/auto/classify_pdf.php?doc_id=uuid
require_once __DIR__ . '/../_bootstrap.php';
requireAdminSession();

$docId = $_GET['doc_id'] ?? (body()['docId'] ?? null);
if (!$docId) fail('doc_id required');

$stmt = $pdo->prepare('SELECT * FROM admin_docs WHERE id = ?');
$stmt->execute([$docId]);
$doc = $stmt->fetch();
if (!$doc) fail('Document not found', 404);

$pdfPath = realpath(__DIR__ . '/../../private_docs') . '/' . $doc['filename'];
if (!file_exists($pdfPath)) fail('PDF not found on disk', 404);

// Extract readable text from the PDF binary (no external libraries needed).
// Pulls parenthesized strings and BT...ET text blocks — imperfect but gives
// Claude enough signal to classify title/category without a paid API call.
$binary = file_get_contents($pdfPath);
$text   = '';

// Text between BT (Begin Text) and ET (End Text) markers
preg_match_all('/BT\s(.*?)\sET/s', $binary, $btMatches);
foreach ($btMatches[1] as $block) {
    preg_match_all('/\(([^)]{1,200})\)/', $block, $strMatches);
    $text .= ' ' . implode(' ', $strMatches[1]);
}

// Fallback: all parenthesized strings in the file
if (strlen(trim($text)) < 50) {
    preg_match_all('/\(([^\)]{3,200})\)/', $binary, $fallback);
    $text = implode(' ', $fallback[1]);
}

// Keep only printable ASCII, collapse whitespace, limit to 3000 chars for context
$text = preg_replace('/[^\x20-\x7E\n]/', ' ', $text);
$text = preg_replace('/\s+/', ' ', trim($text));
$text = mb_substr($text, 0, 3000);

ok([
    'id'           => $doc['id'],
    'filename'     => $doc['original_name'],
    'currentTitle' => $doc['title'],
    'currentCategory' => $doc['category'],
    'extractedText' => $text ?: '(no readable text extracted)',
    'fileSize'     => (int)$doc['file_size'],
]);
