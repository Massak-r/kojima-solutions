<?php
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/_client_email.php';

function mapIntake(array $r): array {
    return [
        'id'                  => $r['id'],
        'projectId'           => $r['project_id'] ?? null,
        'clientName'          => $r['client_name'] ?? '',
        'clientEmail'         => $r['client_email'] ?? '',
        'responses'           => $r['responses_json'] ? json_decode($r['responses_json'], true) : [],
        'suggestedTier'       => $r['suggested_tier'] ?? null,
        'suggestedTemplateId' => $r['suggested_template_id'] ?? null,
        'status'              => $r['status'],
        'createdAt'           => $r['created_at'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;
$projectIdFilter = $_GET['project_id'] ?? null;

// GET — by project_id (admin only)
if ($method === 'GET' && !$id && $projectIdFilter) {
    requireAdminSession();
    $stmt = $pdo->prepare('SELECT * FROM intake_responses WHERE project_id = ? ORDER BY created_at DESC');
    $stmt->execute([$projectIdFilter]);
    $rows = $stmt->fetchAll();
    ok(array_map('mapIntake', $rows));
}

// GET — list all (admin only)
if ($method === 'GET' && !$id) {
    requireAdminSession();
    $rows = $pdo->query('SELECT * FROM intake_responses ORDER BY created_at DESC')->fetchAll();
    ok(array_map('mapIntake', $rows));
}

// GET — single (admin only)
if ($method === 'GET' && $id) {
    requireAdminSession();
    $stmt = $pdo->prepare('SELECT * FROM intake_responses WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) fail('Not found', 404);
    ok(mapIntake($row));
}

// POST — submit intake (public, no auth)
if ($method === 'POST' && !$id) {
    $data = body();
    if (empty($data['clientName']) && empty($data['clientEmail'])) {
        fail('clientName or clientEmail required');
    }

    $iId = uuid();
    $stmt = $pdo->prepare('INSERT INTO intake_responses (id, client_name, client_email, responses_json, suggested_tier, suggested_template_id, status) VALUES (?,?,?,?,?,?,?)');
    $stmt->execute([
        $iId,
        $data['clientName'] ?? '',
        $data['clientEmail'] ?? '',
        !empty($data['responses']) ? json_encode($data['responses']) : null,
        $data['suggestedTier'] ?? null,
        $data['suggestedTemplateId'] ?? null,
        'new',
    ]);

    // Insert notification for bell + push (no auto-email)
    try {
        $responses = $data['responses'] ?? [];
        $projectType = $responses['projectType'] ?? 'Non spécifié';
        $goals = is_array($responses['goals'] ?? null) ? implode(', ', $responses['goals']) : '';
        $timeline = $responses['timeline'] ?? '';
        $tier = $data['suggestedTier'] ?? 'essential';
        $clientName = $data['clientName'] ?? '';
        $clientEmail = $data['clientEmail'] ?? '';

        $pdo->prepare('INSERT INTO notifications (id, project_id, project_title, task_title, client_name, question, response) VALUES (?,?,?,?,?,?,?)')
            ->execute([uuid(), null, 'Nouvel intake', $projectType, $clientName, "Forfait: $tier · Délai: $timeline", $clientEmail]);

        // Queue confirmation email for admin to review and send
        require_once __DIR__ . '/_queue_email.php';
        if ($clientEmail) {
            $tierLabels = ['essential' => 'Essentiel', 'professional' => 'Professionnel', 'custom' => 'Sur mesure'];
            $tierLabel = $tierLabels[$data['suggestedTier'] ?? ''] ?? 'Essentiel';

            queueEmail(
                $pdo,
                $clientEmail,
                $clientName,
                "Kojima Solutions — Votre demande a bien été reçue",
                "Bonjour $clientName,\n\n"
                . "Merci pour votre demande de projet. Voici un résumé :\n\n"
                . "Type de projet : $projectType\n"
                . "Forfait suggéré : $tierLabel\n\n"
                . "Prochaines étapes :\n"
                . "1) Nous analysons votre brief\n"
                . "2) Nous vous contactons sous 24h\n"
                . "3) Séance de cadrage gratuite et sans engagement\n\n"
                . "À très vite !",
                '',
                'intake',
                null
            );
        }
    } catch (Throwable $e) {}

    ok(['id' => $iId, 'status' => 'new']);
}

// PUT — update status / link to project (admin)
if ($method === 'PUT' && $id) {
    requireAdminSession();
    $data = body();
    $sets = [];
    $vals = [];
    foreach (['status' => 'status', 'projectId' => 'project_id', 'suggestedTier' => 'suggested_tier', 'suggestedTemplateId' => 'suggested_template_id'] as $js => $col) {
        if (array_key_exists($js, $data)) {
            $sets[] = "$col = ?";
            $vals[] = $data[$js];
        }
    }
    if ($sets) {
        $vals[] = $id;
        $pdo->prepare('UPDATE intake_responses SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
    }

    $stmt = $pdo->prepare('SELECT * FROM intake_responses WHERE id = ?');
    $stmt->execute([$id]);
    ok(mapIntake($stmt->fetch()));
}

// DELETE (admin)
if ($method === 'DELETE' && $id) {
    requireAdminSession();
    $pdo->prepare('DELETE FROM intake_responses WHERE id = ?')->execute([$id]);
    ok();
}

fail('Invalid request', 400);
