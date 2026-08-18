<?php
/**
 * Web Push notification sender using VAPID (raw PHP + openssl).
 * Include this file from digest.php or any script that needs to send push.
 *
 * Usage:
 *   require_once __DIR__ . '/push_send.php';
 *   $results = sendPushNotifications($pdo, $title, $body, $url);
 */

/**
 * Send push notification to all stored subscriptions.
 *
 * @param PDO    $pdo   Database connection
 * @param string $title Notification title
 * @param string $body  Notification body text
 * @param string $url   URL to open on click
 * @return array        Results: ['sent' => int, 'failed' => int, 'expired' => int]
 */
function sendPushNotifications(PDO $pdo, string $title, string $body, string $url = '/space'): array {
    if (!defined('VAPID_PUBLIC_KEY') || !defined('VAPID_PRIVATE_KEY')) {
        return ['sent' => 0, 'failed' => 0, 'expired' => 0, 'error' => 'VAPID keys not configured'];
    }

    $subs = $pdo->query('SELECT * FROM push_subscriptions')->fetchAll();
    if (empty($subs)) {
        // Logged like any other attempt: "no phone is listening" is the single
        // most likely reason a reminder never arrived, and it used to leave no
        // trace at all.
        $none = ['sent' => 0, 'failed' => 0, 'expired' => 0, 'codes' => ['no-subscription' => 1]];
        logPushSend($pdo, $title, $body, $url, $none);
        return $none;
    }

    $payload = json_encode([
        'title' => $title,
        'body'  => $body,
        'url'   => $url,
        'icon'  => '/icons/icon-192x192.png',
        'badge' => '/icons/icon-192x192.png',
    ]);

    // 'codes' keeps a compact tally of the HTTP statuses the push services
    // returned. Without it a failure is completely opaque, which is how a dead
    // pipeline stayed invisible for months.
    $results = ['sent' => 0, 'failed' => 0, 'expired' => 0, 'codes' => []];

    foreach ($subs as $sub) {
        $statusCode = sendSinglePush($sub['endpoint'], $sub['p256dh'], $sub['auth'], $payload);
        $bucket = (string)$statusCode;
        $results['codes'][$bucket] = ($results['codes'][$bucket] ?? 0) + 1;

        if ($statusCode >= 200 && $statusCode < 300) {
            $results['sent']++;
        } elseif ($statusCode === 410 || $statusCode === 404) {
            // Subscription expired — remove it
            $pdo->prepare('DELETE FROM push_subscriptions WHERE id = ?')->execute([$sub['id']]);
            $results['expired']++;
        } else {
            $results['failed']++;
        }
    }

    logPushSend($pdo, $title, $body, $url, $results);

    return $results;
}

/**
 * Append one row per send to `push_log`.
 *
 * "When did the last push actually go out?" had no answer anywhere: the pulse
 * left only a once-per-day claim in deadline_alerts, and a delivery that failed
 * on every endpoint looked exactly like a day with nothing due. One append-only
 * row per send makes the pipeline's history readable — and is what
 * push_health.php reads back. Best-effort: a logging failure must never stop a
 * notification from going out.
 */
function logPushSend(PDO $pdo, string $title, string $body, string $url, array $results): void {
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS push_log (
            id         VARCHAR(36) NOT NULL PRIMARY KEY,
            title      VARCHAR(255) NOT NULL,
            body       TEXT NULL,
            url        VARCHAR(512) NULL,
            sent       INT NOT NULL DEFAULT 0,
            failed     INT NOT NULL DEFAULT 0,
            expired    INT NOT NULL DEFAULT 0,
            codes      VARCHAR(191) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        // push_send.php is include-only and can be pulled in before _bootstrap's
        // uuid() exists, so keep a local fallback rather than fataling here.
        $id = function_exists('uuid') ? uuid() : bin2hex(random_bytes(18));
        $codes = json_encode($results['codes'] ?? [], JSON_UNESCAPED_SLASHES);

        $pdo->prepare('INSERT INTO push_log (id, title, body, url, sent, failed, expired, codes)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([
                $id,
                mb_substr($title, 0, 255),
                $body,
                mb_substr($url, 0, 512),
                (int)($results['sent'] ?? 0),
                (int)($results['failed'] ?? 0),
                (int)($results['expired'] ?? 0),
                mb_substr((string)$codes, 0, 191),
            ]);
    } catch (Throwable $e) { /* logging is never worth a lost notification */ }
}

/**
 * Send a single push notification via Web Push protocol.
 * Uses VAPID authentication with raw PHP/openssl.
 *
 * @return int HTTP status code
 */
function sendSinglePush(string $endpoint, string $p256dh, string $auth, string $payload): int {
    $vapidSubject    = defined('VAPID_SUBJECT') ? VAPID_SUBJECT : 'mailto:noreply@kojima-solutions.ch';
    $vapidPublicKey  = VAPID_PUBLIC_KEY;
    $vapidPrivateKey = VAPID_PRIVATE_KEY;

    // Parse endpoint URL for audience
    $parsed   = parse_url($endpoint);
    $audience = $parsed['scheme'] . '://' . $parsed['host'];

    // Create VAPID JWT
    $header = base64UrlEncode(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
    $claims = base64UrlEncode(json_encode([
        'aud' => $audience,
        'exp' => time() + 86400,
        'sub' => $vapidSubject,
    ]));

    $signingInput = "$header.$claims";

    // Sign with ES256
    $privKeyDer = base64UrlDecode($vapidPrivateKey);
    $pem = createEcPrivateKeyPem($privKeyDer, base64UrlDecode($vapidPublicKey));

    $privKey = openssl_pkey_get_private($pem);
    if (!$privKey) return 0;

    $signature = '';
    openssl_sign($signingInput, $signature, $privKey, OPENSSL_ALGO_SHA256);

    // Convert DER signature to raw r||s format
    $rawSig    = derToRaw($signature);
    $jwt       = $signingInput . '.' . base64UrlEncode($rawSig);

    // Encrypt payload using Web Push encryption (simplified — using sodium if available)
    $encrypted = encryptPayload($payload, $p256dh, $auth);
    if ($encrypted === null) return 0;

    // Send via cURL
    $headers = [
        'Content-Type: application/octet-stream',
        'Content-Encoding: aes128gcm',
        'Content-Length: ' . strlen($encrypted['ciphertext']),
        'TTL: 86400',
        'Authorization: vapid t=' . $jwt . ', k=' . $vapidPublicKey,
    ];

    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $encrypted['ciphertext'],
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
    ]);

    curl_exec($ch);
    $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return $httpCode;
}

/**
 * Encrypt push payload using aes128gcm content encoding.
 * Requires the sodium extension (available on PHP 7.2+).
 */
function encryptPayload(string $payload, string $userPublicKeyB64, string $userAuthB64): ?array {
    if (!function_exists('sodium_crypto_aead_aes256gcm_is_available')) {
        // Fallback: try openssl approach
        return encryptPayloadOpenssl($payload, $userPublicKeyB64, $userAuthB64);
    }
    return encryptPayloadOpenssl($payload, $userPublicKeyB64, $userAuthB64);
}

function encryptPayloadOpenssl(string $payload, string $userPublicKeyB64, string $userAuthB64): ?array {
    $userPublicKey = base64UrlDecode($userPublicKeyB64);
    $userAuth      = base64UrlDecode($userAuthB64);

    // Generate local ECDH key pair
    $localKey = openssl_pkey_new([
        'curve_name'       => 'prime256v1',
        'private_key_type' => OPENSSL_KEYTYPE_EC,
    ]);
    if (!$localKey) return null;

    $localDetails = openssl_pkey_get_details($localKey);
    // openssl_pkey_get_details() returns the EC coordinates as RAW BINARY, not as
    // a hex string. The previous hex2bin() therefore failed on every single send,
    // leaving an empty local public key and breaking the ECDH exchange that
    // follows — which is why no push has ever been delivered.
    $localPublicKey = "\x04" // uncompressed point
        . str_pad($localDetails['ec']['x'], 32, "\x00", STR_PAD_LEFT)
        . str_pad($localDetails['ec']['y'], 32, "\x00", STR_PAD_LEFT);

    // Compute shared secret via ECDH
    $sharedSecret = computeEcdh($localKey, $userPublicKey);
    if ($sharedSecret === null) return null;

    // Key derivation using HKDF
    $ikm = hkdf($userAuth, $sharedSecret, "WebPush: info\x00" . $userPublicKey . $localPublicKey, 32);

    $salt      = random_bytes(16);
    $prk       = hash_hmac('sha256', $ikm, $salt, true);
    $contentKey = mb_substr(hash_hmac('sha256', "Content-Encoding: aes128gcm\x00\x01", $prk, true), 0, 16, '8bit');
    $nonce     = mb_substr(hash_hmac('sha256', "Content-Encoding: nonce\x00\x01", $prk, true), 0, 12, '8bit');

    // Pad payload
    $padded = $payload . "\x02";

    // Encrypt with AES-128-GCM
    $tag       = '';
    $encrypted = openssl_encrypt($padded, 'aes-128-gcm', $contentKey, OPENSSL_RAW_DATA, $nonce, $tag, '', 16);
    if ($encrypted === false) return null;

    // Build aes128gcm header: salt (16) + rs (4) + idlen (1) + keyid (65)
    $recordSize = pack('N', 4096);
    $header     = $salt . $recordSize . chr(65) . $localPublicKey;

    return ['ciphertext' => $header . $encrypted . $tag];
}

function computeEcdh($localPrivKey, string $peerPublicKey): ?string {
    // Use openssl to derive shared secret
    $peerPem = createEcPublicKeyPem($peerPublicKey);
    $peerKey = openssl_pkey_get_public($peerPem);
    if (!$peerKey) return null;

    // openssl_pkey_derive() takes (public, private) in THAT order — they were
    // swapped. The length is in bytes too, and P-256 yields exactly 32.
    $shared = openssl_pkey_derive($peerKey, $localPrivKey, 32);
    return $shared ?: null;
}

function hkdf(string $salt, string $ikm, string $info, int $length): string {
    $prk = hash_hmac('sha256', $ikm, $salt, true);
    return mb_substr(hash_hmac('sha256', $info . "\x01", $prk, true), 0, $length, '8bit');
}

function base64UrlEncode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64UrlDecode(string $data): string {
    return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', (4 - strlen($data) % 4) % 4));
}

function derToRaw(string $der): string {
    // Parse DER-encoded ECDSA signature to raw r||s (each 32 bytes)
    $offset = 2;
    $rLen   = ord($der[$offset + 1]);
    $r      = substr($der, $offset + 2, $rLen);
    $offset += 2 + $rLen;
    $sLen   = ord($der[$offset + 1]);
    $s      = substr($der, $offset + 2, $sLen);

    // Pad/trim to 32 bytes each
    $r = str_pad(ltrim($r, "\x00"), 32, "\x00", STR_PAD_LEFT);
    $s = str_pad(ltrim($s, "\x00"), 32, "\x00", STR_PAD_LEFT);

    return $r . $s;
}

function createEcPrivateKeyPem(string $privateKeyRaw, string $publicKeyRaw): string {
    // Build DER for EC private key with prime256v1
    $oid = hex2bin('06082a8648ce3d030107');  // OID for prime256v1
    $privKey = "\x04" . chr(strlen($privateKeyRaw)) . $privateKeyRaw;
    $pubKey  = "\x03" . chr(strlen($publicKeyRaw) + 1) . "\x00" . $publicKeyRaw;

    $seq = "\x02\x01\x01" . $privKey . "\xa0" . chr(strlen($oid)) . $oid . "\xa1" . chr(strlen($pubKey)) . $pubKey;
    $der = "\x30" . chr(strlen($seq)) . $seq;

    return "-----BEGIN EC PRIVATE KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END EC PRIVATE KEY-----\n";
}

function createEcPublicKeyPem(string $publicKeyRaw): string {
    // Build DER for EC public key with prime256v1
    $header = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200');
    $der    = $header . $publicKeyRaw;

    return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n";
}
