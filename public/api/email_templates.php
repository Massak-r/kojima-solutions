<?php
/**
 * Email Templates — admin can view/edit email templates used by the system.
 * Templates are stored in DB. If not set, defaults are used.
 */
require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

// Auto-migrate
try {
    $pdo->exec('
        CREATE TABLE IF NOT EXISTS email_templates (
            id VARCHAR(50) PRIMARY KEY,
            label VARCHAR(255) NOT NULL,
            subject VARCHAR(500) NOT NULL,
            body TEXT NOT NULL,
            description VARCHAR(500) DEFAULT NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ');
} catch (Throwable $e) {}

// Default templates — used if not customized
$defaults = [
    'feedback' => [
        'label' => 'Demande de feedback',
        'description' => 'Envoyé au client quand une demande de feedback est créée sur une étape.',
        'subject' => '{project_title} — Votre avis est demandé',
        'body' => "Bonjour,\n\nNous avons besoin de votre retour sur le projet « {project_title} » :\n\n→ {message}\n\nRendez-vous sur votre espace projet pour répondre :",
    ],
    'gate' => [
        'label' => 'Action requise (gate)',
        'description' => 'Envoyé au décideur quand une gate de parcours est ouverte.',
        'subject' => '{project_title} — Action requise : {gate_title}',
        'body' => "Bonjour,\n\nUne nouvelle étape nécessite votre {type_label} sur le projet « {project_title} » :\n\n→ {gate_title}\n\nRendez-vous sur votre espace projet pour continuer :",
    ],
    'intake' => [
        'label' => 'Confirmation intake',
        'description' => 'Envoyé au client après soumission du formulaire de demande.',
        'subject' => 'Kojima Solutions — Votre demande a bien été reçue',
        'body' => "Bonjour {client_name},\n\nMerci pour votre demande de projet. Voici un résumé :\n\nType de projet : {project_type}\nForfait suggéré : {tier}\n\nProchaines étapes :\n1) Nous analysons votre brief\n2) Nous vous contactons sous 24h\n3) Séance de cadrage gratuite et sans engagement\n\nÀ très vite !",
    ],
    'stakeholder-invite' => [
        'label' => 'Invitation stakeholder',
        'description' => 'Envoyé quand vous invitez un stakeholder à suivre un projet.',
        'subject' => 'Invitation : {project_title}',
        'body' => "Bonjour {name},\n\nVous avez été invité(e) à suivre le projet « {project_title} » sur Kojima Solutions.\n\nAccédez au projet via le lien ci-dessous pour consulter l'avancement, voter et donner votre avis.",
    ],
    'invoice-reminder' => [
        'label' => 'Rappel de facture',
        'description' => 'Envoyé comme rappel de paiement pour une facture.',
        'subject' => 'Rappel - Facture {quote_number}',
        'body' => "Bonjour {client_name},\n\nUn petit rappel concernant la facture {quote_number} d'un montant de CHF {amount}.\n\nSi le paiement a déjà été effectué, veuillez ignorer ce message.\n\nCordialement,\nKojima Solutions",
    ],
];

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

// GET — list all templates (merge defaults with customized)
if ($method === 'GET') {
    $stmt = $pdo->query('SELECT * FROM email_templates');
    $custom = [];
    foreach ($stmt->fetchAll() as $row) {
        $custom[$row['id']] = $row;
    }

    $result = [];
    foreach ($defaults as $key => $def) {
        if (isset($custom[$key])) {
            $row = $custom[$key];
            $result[] = [
                'id' => $key,
                'label' => $def['label'],
                'description' => $def['description'],
                'subject' => $row['subject'],
                'body' => $row['body'],
                'customized' => true,
                'updatedAt' => $row['updated_at'],
            ];
        } else {
            $result[] = [
                'id' => $key,
                'label' => $def['label'],
                'description' => $def['description'],
                'subject' => $def['subject'],
                'body' => $def['body'],
                'customized' => false,
                'updatedAt' => null,
            ];
        }
    }
    ok($result);
}

// PUT ?id=X — update a template
if ($method === 'PUT' && $id) {
    $d = body();
    $def = $defaults[$id] ?? null;
    if (!$def) fail('Unknown template', 404);

    $subject = $d['subject'] ?? $def['subject'];
    $body = $d['body'] ?? $def['body'];

    $pdo->prepare('
        INSERT INTO email_templates (id, label, subject, body) VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE subject = VALUES(subject), body = VALUES(body), updated_at = NOW()
    ')->execute([$id, $def['label'], $subject, $body]);

    ok(['id' => $id, 'updated' => true]);
}

// DELETE ?id=X — reset template to default
if ($method === 'DELETE' && $id) {
    $pdo->prepare('DELETE FROM email_templates WHERE id = ?')->execute([$id]);
    ok(['id' => $id, 'reset' => true]);
}

fail('Invalid request', 400);
