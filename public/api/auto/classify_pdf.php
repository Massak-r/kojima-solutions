<?php
// Phase 2a — Auto-classify an admin PDF doc via Claude AI.
// Suggests title, category, and tags; updates the admin_docs record in place.
// POST /api/auto/classify_pdf.php  body: {docId: "uuid"}
// GET  /api/auto/classify_pdf.php?doc_id=uuid
require_once __DIR__ . '/../_bootstrap.php';
requireAuth();

if (!defined('ANTHROPIC_API_KEY') || !ANTHROPIC_API_KEY) {
    fail('ANTHROPIC_API_KEY not configured in config.php', 503);
}

$data  = $_SERVER['REQUEST_METHOD'] === 'POST' ? body() : [];
$docId = $_GET['doc_id'] ?? $data['docId'] ?? null;
if (!$docId) fail('doc_id required');

$stmt = $pdo->prepare('SELECT * FROM admin_docs WHERE id = ?');
$stmt->execute([$docId]);
$doc = $stmt->fetch();
if (!$doc) fail('Document not found', 404);

$pdfPath = realpath(__DIR__ . '/../../private_docs') . '/' . $doc['filename'];
if (!file_exists($pdfPath)) fail('PDF not found on disk', 404);

$pdfB64 = base64_encode(file_get_contents($pdfPath));

$payload = json_encode([
    'model'      => 'claude-haiku-4-5-20251001',
    'max_tokens' => 300,
    'messages'   => [[
        'role'    => 'user',
        'content' => [
            [
                'type'   => 'document',
                'source' => [
                    'type'       => 'base64',
                    'media_type' => 'application/pdf',
                    'data'       => $pdfB64,
                ],
            ],
            [
                'type' => 'text',
                'text' => "Analyse ce PDF et retourne UNIQUEMENT un objet JSON (sans markdown) avec:\n" .
                          "- \"title\": titre court descriptif (max 60 chars)\n" .
                          "- \"category\": une parmi [\"Comptabilité\",\"Contrats\",\"Administratif\",\"Technique\",\"RH\",\"Clients\",\"Autre\"]\n" .
                          "- \"tags\": tableau de 2-4 mots-clés\n" .
                          "Réponds UNIQUEMENT avec le JSON, sans texte autour.",
            ],
        ],
    ]],
]);

$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'x-api-key: ' . ANTHROPIC_API_KEY,
        'anthropic-version: 2023-06-01',
    ],
    CURLOPT_POSTFIELDS => $payload,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200 || !$response) {
    fail('Anthropic API error (' . $httpCode . '): ' . substr($response ?: '', 0, 200), 502);
}

$apiResult = json_decode($response, true);
$raw       = $apiResult['content'][0]['text'] ?? '';
$raw       = preg_replace('/^```(?:json)?\s*|\s*```$/s', '', trim($raw));
$suggestion = json_decode($raw, true);

if (!$suggestion || empty($suggestion['title'])) {
    fail('Could not parse AI suggestion: ' . $raw, 502);
}

$newTitle = substr(trim($suggestion['title']), 0, 120);
$newCat   = $suggestion['category'] ?? $doc['category'];

$pdo->prepare('UPDATE admin_docs SET title = ?, category = ? WHERE id = ?')
    ->execute([$newTitle, $newCat, $docId]);

$stmt = $pdo->prepare('SELECT * FROM admin_docs WHERE id = ?');
$stmt->execute([$docId]);
$updated = $stmt->fetch();

ok([
    'id'         => $updated['id'],
    'title'      => $updated['title'],
    'category'   => $updated['category'],
    'tags'       => $suggestion['tags'] ?? [],
    'suggestion' => $suggestion,
]);
