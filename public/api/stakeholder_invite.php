<?php
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/_queue_email.php';
requireAdminSession();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Method not allowed', 405);
}

$d = body();
$stakeholderId = trim($d['stakeholderId'] ?? '');
$projectId     = trim($d['projectId'] ?? '');

if (!$stakeholderId || !$projectId) fail('stakeholderId and projectId required', 400);

// Look up stakeholder
$shStmt = $pdo->prepare("SELECT * FROM project_stakeholders WHERE id = ?");
$shStmt->execute([$stakeholderId]);
$stakeholder = $shStmt->fetch();
if (!$stakeholder) fail('Stakeholder not found', 404);

// Look up project
$projStmt = $pdo->prepare("SELECT id, title, share_token FROM projects WHERE id = ?");
$projStmt->execute([$projectId]);
$project = $projStmt->fetch();
if (!$project) fail('Project not found', 404);

// Ensure share token exists
$token = $project['share_token'];
if (!$token) {
    $token = uuid();
    $pdo->prepare("UPDATE projects SET share_token = ? WHERE id = ?")->execute([$token, $projectId]);
}

$link = SITE_URL . "/project/s/{$token}";

$subject = "Invitation : {$project['title']}";
$body = "Bonjour {$stakeholder['name']},\n\n"
      . "Vous avez été invité(e) à suivre le projet « {$project['title']} » sur Kojima Solutions.\n\n"
      . "Accédez au projet via le lien ci-dessous pour consulter l'avancement, voter et donner votre avis.";

queueEmail($pdo, $stakeholder['email'], $stakeholder['name'], $subject, $body, $link, 'stakeholder-invite', $projectId);

ok(['queued' => true]);
