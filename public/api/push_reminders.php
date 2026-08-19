<?php
require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

// Programmable push reminders ("comme un calendar"). The cron (digest.php)
// scans this table every ~20 min and fires any reminder whose scheduled_at
// has passed, reusing the existing web-push send path. Auto-migrates on first
// hit. Idempotent.
try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS push_reminders (
            id            VARCHAR(36) PRIMARY KEY,
            title         VARCHAR(255) NOT NULL,
            body          TEXT NULL,
            url           VARCHAR(512) NOT NULL DEFAULT '/home',
            scheduled_at  DATETIME NOT NULL,
            sent_at       DATETIME NULL,
            created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_due (sent_at, scheduled_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
} catch (Throwable $e) {}

// Provenance of a reminder. NULL = créé à la main dans Réglages. Renseigné =
// posé automatiquement par la synchro des alertes de paiement (digest.php), qui
// s'en sert comme clé d'idempotence : une alerte par (source, échéance), jamais
// deux, et retirée d'elle-même quand la facture est réglée.
try {
    $cols = $pdo->query('SHOW COLUMNS FROM push_reminders')->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('source_type', $cols)) $pdo->exec("ALTER TABLE push_reminders ADD COLUMN source_type VARCHAR(32) NULL");
    if (!in_array('source_id', $cols))   $pdo->exec("ALTER TABLE push_reminders ADD COLUMN source_id VARCHAR(36) NULL");
    if (!in_array('source_slot', $cols)) $pdo->exec("ALTER TABLE push_reminders ADD COLUMN source_slot VARCHAR(16) NULL");
} catch (Throwable $e) {}
// Index à part : il échoue s'il existe déjà, et ce n'est pas une erreur. Les
// NULL n'y sont pas contraints, donc les rappels manuels restent libres.
try { $pdo->exec("CREATE UNIQUE INDEX uniq_reminder_source ON push_reminders (source_type, source_id, source_slot)"); } catch (Throwable $e) {}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // ?status=upcoming (default, not yet sent) | all
    $status = $_GET['status'] ?? 'upcoming';
    $sql = 'SELECT id, title, body, url, scheduled_at, sent_at, created_at, source_type, source_id, source_slot FROM push_reminders';
    if ($status === 'upcoming') $sql .= ' WHERE sent_at IS NULL';
    $sql .= ' ORDER BY scheduled_at ASC LIMIT 200';
    ok(['items' => $pdo->query($sql)->fetchAll()]);
}

if ($method === 'POST') {
    $b     = json_decode(file_get_contents('php://input'), true);
    $title = trim((string)($b['title'] ?? ''));
    $body  = isset($b['body']) ? trim((string)$b['body']) : null;
    $url   = (isset($b['url']) && $b['url']) ? substr((string)$b['url'], 0, 512) : '/home';
    $when  = trim((string)($b['scheduledAt'] ?? ''));
    if ($title === '') fail('title required');
    if (strlen($title) > 255) fail('title too long (max 255)');
    $ts = strtotime($when);
    if ($ts === false) fail('scheduledAt invalid (expect an ISO datetime)');

    // Store in UTC (client sends an ISO-Z absolute time); the cron compares
    // against UTC_TIMESTAMP() so firing is correct regardless of server TZ.
    $id = uuid();
    $pdo->prepare("INSERT INTO push_reminders (id, title, body, url, scheduled_at) VALUES (?, ?, ?, ?, ?)")
        ->execute([$id, $title, $body ?: null, $url, gmdate('Y-m-d H:i:s', $ts)]);

    $stmt = $pdo->prepare("SELECT id, title, body, url, scheduled_at, sent_at, created_at FROM push_reminders WHERE id = ?");
    $stmt->execute([$id]);
    ok($stmt->fetch());
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? '';
    if (!preg_match('/^[0-9a-f-]{36}$/i', $id)) fail('Invalid id');

    // Retirer une alerte automatique doit vouloir dire quelque chose. Sans
    // pierre tombale, la synchro suivante la recrée dans l'heure et le bouton
    // « supprimer » ne fait que clignoter. La clé porte l'échéance précise, donc
    // une facture récurrente (nouvel id à chaque cycle) retrouve ses alertes le
    // mois suivant : on écarte celle-ci, pas la série.
    $src = $pdo->prepare("SELECT source_type, source_id, source_slot FROM push_reminders WHERE id = ?");
    $src->execute([$id]);
    $row = $src->fetch();
    if ($row && !empty($row['source_type'])) {
        try {
            $pdo->prepare("INSERT IGNORE INTO deadline_alerts (alert_key) VALUES (?)")
                ->execute(['payalert_off:' . $row['source_type'] . ':' . $row['source_id'] . ':' . $row['source_slot']]);
        } catch (Throwable $e) { /* table absente = rien à mémoriser */ }
    }

    $pdo->prepare("DELETE FROM push_reminders WHERE id = ?")->execute([$id]);
    ok();
}

fail('Method not allowed', 405);
