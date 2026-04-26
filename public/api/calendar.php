<?php
/**
 * Google Calendar API proxy.
 * Uses a Service Account (no OAuth consent flow).
 *
 * config.php must define:
 *   GOOGLE_SA_KEY_PATH — absolute path to the downloaded .json key file
 *   GOOGLE_CALENDAR_ID — e.g. 'chraiti.massaki@gmail.com'
 */
require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

// ── Config check ───────────────────────────────────────────────────────────────
if (!defined('GOOGLE_SA_KEY_PATH') || !defined('GOOGLE_CALENDAR_ID')) {
    fail('Google Calendar not configured. Set GOOGLE_SA_KEY_PATH & GOOGLE_CALENDAR_ID in config.php.', 503);
}
$saKeyFile = GOOGLE_SA_KEY_PATH;
if (!file_exists($saKeyFile)) {
    fail('Service account key file not found at: ' . $saKeyFile, 503);
}
$saKey = json_decode(file_get_contents($saKeyFile), true);
if (!$saKey || empty($saKey['private_key']) || empty($saKey['client_email'])) {
    fail('Invalid service account key file.', 503);
}

$calendarId = GOOGLE_CALENDAR_ID;

// ── Access Token (cached) ──────────────────────────────────────────────────────
function getAccessToken(array $saKey): string {
    $cacheFile = sys_get_temp_dir() . '/kojima_google_token.json';
    if (file_exists($cacheFile)) {
        $cached = json_decode(file_get_contents($cacheFile), true);
        if ($cached && time() < ($cached['expires_at'] ?? 0)) {
            return $cached['access_token'];
        }
    }

    $now = time();
    $header  = base64url_encode(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
    $payload = base64url_encode(json_encode([
        'iss'   => $saKey['client_email'],
        'scope' => 'https://www.googleapis.com/auth/calendar',
        'aud'   => 'https://oauth2.googleapis.com/token',
        'iat'   => $now,
        'exp'   => $now + 3600,
    ]));

    $toSign = "$header.$payload";
    openssl_sign($toSign, $signature, $saKey['private_key'], 'SHA256');
    $jwt = "$toSign." . base64url_encode($signature);

    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion'  => $jwt,
        ]),
    ]);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($code !== 200) {
        fail('Failed to get Google access token: ' . $res, 502);
    }

    $data = json_decode($res, true);
    $data['expires_at'] = $now + ($data['expires_in'] ?? 3600) - 60;
    file_put_contents($cacheFile, json_encode($data));
    return $data['access_token'];
}

function base64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

// ── Google Calendar API helpers ────────────────────────────────────────────────
function gcalRequest(string $method, string $url, ?array $body = null): array {
    global $saKey;
    $token = getAccessToken($saKey);

    $ch = curl_init($url);
    $headers = [
        'Authorization: Bearer ' . $token,
        'Content-Type: application/json',
    ];
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_CUSTOMREQUEST  => $method,
    ];
    if ($body !== null) {
        $opts[CURLOPT_POSTFIELDS] = json_encode($body);
    }
    curl_setopt_array($ch, $opts);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return ['code' => $code, 'data' => json_decode($res, true) ?? []];
}

$baseUrl = "https://www.googleapis.com/calendar/v3/calendars/" . urlencode($calendarId);
$method  = $_SERVER['REQUEST_METHOD'];

// ── GET: list events ───────────────────────────────────────────────────────────
if ($method === 'GET') {
    $timeMin = $_GET['timeMin'] ?? date('c');
    $timeMax = $_GET['timeMax'] ?? date('c', strtotime('+30 days'));

    // Simple file cache (5 min)
    $cacheKey  = md5("$calendarId|$timeMin|$timeMax");
    $cacheFile = sys_get_temp_dir() . "/kojima_cal_$cacheKey.json";
    if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < 300) {
        echo file_get_contents($cacheFile);
        exit;
    }

    $url = "$baseUrl/events?" . http_build_query([
        'timeMin'      => $timeMin,
        'timeMax'      => $timeMax,
        'singleEvents' => 'true',
        'orderBy'      => 'startTime',
        'maxResults'   => 100,
    ]);

    $res = gcalRequest('GET', $url);
    if ($res['code'] !== 200) {
        fail('Calendar API error: ' . json_encode($res['data']), $res['code']);
    }

    // Slim down the response
    $items = array_map(function ($e) {
        return [
            'id'          => $e['id'] ?? '',
            'summary'     => $e['summary'] ?? '(sans titre)',
            'description' => $e['description'] ?? null,
            'location'    => $e['location'] ?? null,
            'start'       => $e['start'] ?? [],
            'end'         => $e['end'] ?? [],
            'colorId'     => $e['colorId'] ?? null,
            'htmlLink'    => $e['htmlLink'] ?? null,
        ];
    }, $res['data']['items'] ?? []);

    $output = json_encode($items);
    file_put_contents($cacheFile, $output);
    echo $output;
    exit;
}

// ── POST: create event ─────────────────────────────────────────────────────────
if ($method === 'POST') {
    $b = body();
    if (empty($b['summary'])) fail('summary is required');

    $event = ['summary' => $b['summary']];
    if (!empty($b['description'])) $event['description'] = $b['description'];
    if (!empty($b['location']))    $event['location']    = $b['location'];

    // start/end: either dateTime (timed event) or date (all-day)
    if (!empty($b['start'])) $event['start'] = $b['start'];
    else fail('start is required');
    if (!empty($b['end'])) $event['end'] = $b['end'];
    else fail('end is required');

    $res = gcalRequest('POST', "$baseUrl/events", $event);
    if ($res['code'] < 200 || $res['code'] >= 300) {
        fail('Failed to create event: ' . json_encode($res['data']), $res['code']);
    }
    // Clear cache
    array_map('unlink', glob(sys_get_temp_dir() . '/kojima_cal_*.json'));
    ok($res['data']);
}

// ── PUT: update event ──────────────────────────────────────────────────────────
if ($method === 'PUT') {
    $id = $_GET['id'] ?? '';
    if (!$id) fail('id is required');
    $b = body();
    $res = gcalRequest('PUT', "$baseUrl/events/" . urlencode($id), $b);
    if ($res['code'] < 200 || $res['code'] >= 300) {
        fail('Failed to update event: ' . json_encode($res['data']), $res['code']);
    }
    array_map('unlink', glob(sys_get_temp_dir() . '/kojima_cal_*.json'));
    ok($res['data']);
}

// ── DELETE: delete event ───────────────────────────────────────────────────────
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? '';
    if (!$id) fail('id is required');
    $res = gcalRequest('DELETE', "$baseUrl/events/" . urlencode($id));
    if ($res['code'] !== 204 && $res['code'] !== 200) {
        fail('Failed to delete event: ' . json_encode($res['data']), $res['code']);
    }
    array_map('unlink', glob(sys_get_temp_dir() . '/kojima_cal_*.json'));
    ok();
}

fail('Method not allowed', 405);
