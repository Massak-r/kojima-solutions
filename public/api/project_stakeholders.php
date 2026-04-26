<?php
require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

// ── Auto-migrate ────────────────────────────────────────────────
$pdo->exec("CREATE TABLE IF NOT EXISTS project_stakeholders (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(100) DEFAULT NULL,
  added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_accessed_at DATETIME DEFAULT NULL,
  UNIQUE KEY uq_project_email (project_id, email),
  INDEX idx_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

$method = $_SERVER['REQUEST_METHOD'];

// ── GET: list stakeholders for a project ─────────────────────────
if ($method === 'GET') {
    $projectId = $_GET['project_id'] ?? '';
    if (!$projectId) fail('project_id required', 400);

    $stmt = $pdo->prepare("SELECT * FROM project_stakeholders WHERE project_id = ? ORDER BY added_at ASC");
    $stmt->execute([$projectId]);
    ok($stmt->fetchAll());
}

// ── POST: add stakeholder ────────────────────────────────────────
if ($method === 'POST') {
    $d = body();
    $projectId = trim($d['projectId'] ?? '');
    $name      = trim($d['name'] ?? '');
    $email     = strtolower(trim($d['email'] ?? ''));
    $role      = trim($d['role'] ?? '') ?: null;

    if (!$projectId || !$name || !$email) fail('projectId, name, email required', 400);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Email invalide', 400);

    $id = uuid();
    try {
        $stmt = $pdo->prepare("INSERT INTO project_stakeholders (id, project_id, name, email, role) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$id, $projectId, $name, $email, $role]);
    } catch (PDOException $e) {
        if ($e->getCode() == 23000) fail('Ce stakeholder existe déjà pour ce projet', 409);
        throw $e;
    }

    $fetch = $pdo->prepare("SELECT * FROM project_stakeholders WHERE id = ?");
    $fetch->execute([$id]);
    ok($fetch->fetch());
}

// ── PUT: update stakeholder ──────────────────────────────────────
if ($method === 'PUT') {
    $id = $_GET['id'] ?? '';
    if (!$id) fail('id required', 400);

    $d = body();
    $fields = [];
    $params = [];

    if (isset($d['name']))  { $fields[] = 'name = ?'; $params[] = trim($d['name']); }
    if (isset($d['email'])) { $fields[] = 'email = ?'; $params[] = strtolower(trim($d['email'])); }
    if (array_key_exists('role', $d)) { $fields[] = 'role = ?'; $params[] = $d['role'] ?: null; }

    if (empty($fields)) fail('Nothing to update', 400);

    $params[] = $id;
    $pdo->prepare("UPDATE project_stakeholders SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);

    $fetch = $pdo->prepare("SELECT * FROM project_stakeholders WHERE id = ?");
    $fetch->execute([$id]);
    ok($fetch->fetch());
}

// ── DELETE: remove stakeholder ───────────────────────────────────
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? '';
    if (!$id) fail('id required', 400);

    $pdo->prepare("DELETE FROM project_stakeholders WHERE id = ?")->execute([$id]);
    ok();
}

fail('Method not allowed', 405);
