<?php
require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

function mapAccount(array $row): array {
    return [
        'id'                => $row['id'],
        'name'              => $row['name'],
        'type'              => $row['type'],
        'institution'       => $row['institution'] ?? null,
        'currency'          => $row['currency'] ?? 'CHF',
        'balance'           => (float)$row['balance'],
        'balanceUpdatedAt'  => $row['balance_updated_at'] ?? null,
        'sortOrder'         => (int)($row['sort_order'] ?? 0),
        'isArchived'        => (bool)($row['is_archived'] ?? false),
        'notes'             => $row['notes'] ?? null,
        'createdAt'         => $row['created_at'],
        'updatedAt'         => $row['updated_at'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? null;

if ($method === 'GET') {
    $includeArchived = ($_GET['includeArchived'] ?? '0') === '1';
    $type            = $_GET['type'] ?? null;

    $where  = [];
    $params = [];
    if (!$includeArchived) { $where[] = 'is_archived = 0'; }
    if ($type === 'perso' || $type === 'entreprise') {
        $where[] = 'type = ?';
        $params[] = $type;
    }
    $sql = 'SELECT * FROM accounts'
         . (empty($where) ? '' : ' WHERE ' . implode(' AND ', $where))
         . ' ORDER BY sort_order ASC, created_at ASC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    ok(array_map('mapAccount', $stmt->fetchAll()));
}

if ($method === 'POST') {
    $data  = body();
    $newId = uuid();
    $now   = date('Y-m-d H:i:s');

    $pdo->prepare(
        'INSERT INTO accounts (id, name, type, institution, currency, balance, balance_updated_at, sort_order, is_archived, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $newId,
        trim($data['name'] ?? 'Compte sans nom'),
        ($data['type'] ?? 'perso') === 'entreprise' ? 'entreprise' : 'perso',
        $data['institution'] ?? null,
        $data['currency']    ?? 'CHF',
        (float)($data['balance'] ?? 0),
        array_key_exists('balance', $data) ? $now : null,
        (int)($data['sortOrder'] ?? 0),
        !empty($data['isArchived']) ? 1 : 0,
        $data['notes'] ?? null,
    ]);

    $stmt = $pdo->prepare('SELECT * FROM accounts WHERE id = ?');
    $stmt->execute([$newId]);
    ok(mapAccount($stmt->fetch()));
}

if ($method === 'PUT') {
    if (!$id) fail('Missing id');
    $data   = body();
    $fields = [];
    $values = [];

    if (array_key_exists('name',        $data)) { $fields[] = 'name = ?';        $values[] = trim($data['name']); }
    if (array_key_exists('type',        $data)) {
        $t = $data['type'] === 'entreprise' ? 'entreprise' : 'perso';
        $fields[] = 'type = ?'; $values[] = $t;
    }
    if (array_key_exists('institution', $data)) { $fields[] = 'institution = ?'; $values[] = $data['institution']; }
    if (array_key_exists('currency',    $data)) { $fields[] = 'currency = ?';    $values[] = $data['currency']; }
    if (array_key_exists('balance',     $data)) {
        $fields[] = 'balance = ?';            $values[] = (float)$data['balance'];
        $fields[] = 'balance_updated_at = ?'; $values[] = date('Y-m-d H:i:s');
    }
    if (array_key_exists('sortOrder',   $data)) { $fields[] = 'sort_order = ?';  $values[] = (int)$data['sortOrder']; }
    if (array_key_exists('isArchived',  $data)) { $fields[] = 'is_archived = ?'; $values[] = !empty($data['isArchived']) ? 1 : 0; }
    if (array_key_exists('notes',       $data)) { $fields[] = 'notes = ?';       $values[] = $data['notes']; }

    if (!empty($fields)) {
        $values[] = $id;
        $pdo->prepare('UPDATE accounts SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($values);
    }

    $stmt = $pdo->prepare('SELECT * FROM accounts WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) fail('Account not found', 404);
    ok(mapAccount($row));
}

if ($method === 'DELETE') {
    if (!$id) fail('Missing id');
    $pdo->prepare('UPDATE expenses       SET account_id = NULL WHERE account_id = ?')->execute([$id]);
    $pdo->prepare('UPDATE personal_costs SET account_id = NULL WHERE account_id = ?')->execute([$id]);
    $pdo->prepare('UPDATE payables       SET account_id = NULL WHERE account_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM accounts WHERE id = ?')->execute([$id]);
    ok();
}
