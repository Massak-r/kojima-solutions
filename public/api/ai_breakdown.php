<?php
require_once __DIR__ . '/_bootstrap.php';
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('POST required', 405);

if (!defined('ANTHROPIC_API_KEY') || ANTHROPIC_API_KEY === '') {
    fail('AI assistant not configured. Add ANTHROPIC_API_KEY to api/config.php.', 503);
}

$data = body();
$prompt = trim($data['prompt'] ?? '');
if ($prompt === '') fail('prompt required');
if (strlen($prompt) > 20000) fail('prompt too long', 413);

$model = defined('ANTHROPIC_MODEL') && ANTHROPIC_MODEL !== '' ? ANTHROPIC_MODEL : 'claude-sonnet-4-6';

$payload = [
    'model'      => $model,
    'max_tokens' => 1500,
    'system'     => 'Tu es un assistant qui aide à découper des objectifs en étapes actionnables. Réponds toujours en français, format liste à puces (un tiret par étape). Si pertinent, ajoute une étiquette d\'effort entre crochets [Rapide]/[Moyen]/[Complexe] et une estimation entre parenthèses (N min). N\'ajoute pas d\'introduction ni de conclusion : seulement la liste.',
    'messages'   => [
        ['role' => 'user', 'content' => $prompt],
    ],
];

$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode($payload),
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'x-api-key: ' . ANTHROPIC_API_KEY,
        'anthropic-version: 2023-06-01',
    ],
    CURLOPT_TIMEOUT        => 60,
]);
$raw  = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err  = curl_error($ch);
curl_close($ch);

if ($raw === false) {
    fail('Anthropic request failed: ' . $err, 502);
}
if ($code >= 400) {
    $decoded = json_decode($raw, true);
    $msg = $decoded['error']['message'] ?? ('HTTP ' . $code);
    fail('Anthropic API error: ' . $msg, 502);
}

$decoded = json_decode($raw, true);
if (!is_array($decoded)) fail('Invalid response from Anthropic', 502);

// Concatenate text blocks from the response
$text = '';
foreach (($decoded['content'] ?? []) as $block) {
    if (($block['type'] ?? null) === 'text') $text .= $block['text'];
}
$text = trim($text);

ok([
    'response'   => $text,
    'model'      => $decoded['model']      ?? $model,
    'usage'      => $decoded['usage']      ?? null,
    'stopReason' => $decoded['stop_reason'] ?? null,
]);
