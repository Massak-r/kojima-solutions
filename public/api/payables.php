<?php
require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

function mapPayable(array $row): array {
    return [
        'id'             => $row['id'],
        'label'          => $row['label'],
        'amount'         => (float)$row['amount'],
        'currency'       => $row['currency'] ?? 'CHF',
        'dueDate'        => $row['due_date'] ?? null,
        'accountId'      => $row['account_id'] ?? null,
        'status'         => $row['status'],
        'category'       => $row['category'] ?? null,
        'notes'          => $row['notes'] ?? null,
        'recurrence'     => $row['recurrence'] ?? 'none',
        'recurrenceDay'  => isset($row['recurrence_day']) ? (int)$row['recurrence_day'] : null,
        'recurrenceEnd'  => $row['recurrence_end'] ?? null,
        'paidAt'         => $row['paid_at'] ?? null,
        'sourceType'     => $row['source_type'] ?? null,
        'sourceId'       => $row['source_id'] ?? null,
        'createdAt'      => $row['created_at'],
        'updatedAt'      => $row['updated_at'],
    ];
}

/**
 * Compute next due date for a recurring payable, given the previous due date.
 * Returns YYYY-MM-DD or null if the recurrence has ended.
 */
function nextDueDate(?string $previousDue, string $recurrence, ?int $recurrenceDay, ?string $recurrenceEnd): ?string {
    if ($recurrence === 'none' || !$previousDue) return null;
    $base = new DateTimeImmutable($previousDue);
    $next = match ($recurrence) {
        'weekly'    => $base->modify('+1 week'),
        'monthly'   => $base->modify('+1 month'),
        'quarterly' => $base->modify('+3 months'),
        'yearly'    => $base->modify('+1 year'),
        default     => null,
    };
    if (!$next) return null;
    // Snap to recurrence_day for monthly/quarterly/yearly if set.
    if ($recurrenceDay && in_array($recurrence, ['monthly', 'quarterly', 'yearly'], true)) {
        $day = max(1, min(31, $recurrenceDay));
        $candidate = $next->setDate((int)$next->format('Y'), (int)$next->format('m'), 1);
        $lastDay   = (int)$candidate->format('t');
        $next = $candidate->setDate((int)$candidate->format('Y'), (int)$candidate->format('m'), min($day, $lastDay));
    }
    $iso = $next->format('Y-m-d');
    if ($recurrenceEnd && $iso > $recurrenceEnd) return null;
    return $iso;
}

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? null;

if ($method === 'GET') {
    $status     = $_GET['status']    ?? null;
    $accountId  = $_GET['accountId'] ?? null;
    $where      = [];
    $params     = [];
    if ($status && in_array($status, ['pending','scheduled','paid','cancelled'], true)) {
        $where[] = 'status = ?'; $params[] = $status;
    }
    if ($accountId) {
        $where[] = 'account_id = ?'; $params[] = $accountId;
    }
    $sql = 'SELECT * FROM payables'
         . (empty($where) ? '' : ' WHERE ' . implode(' AND ', $where))
         . ' ORDER BY (due_date IS NULL) ASC, due_date ASC, created_at DESC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    ok(array_map('mapPayable', $stmt->fetchAll()));
}

if ($method === 'POST') {
    $data  = body();
    $newId = uuid();

    $recurrence = $data['recurrence'] ?? 'none';
    if (!in_array($recurrence, ['none','weekly','monthly','quarterly','yearly'], true)) $recurrence = 'none';
    $status = $data['status'] ?? 'pending';
    if (!in_array($status, ['pending','scheduled','paid','cancelled'], true)) $status = 'pending';

    $pdo->prepare(
        'INSERT INTO payables
         (id, label, amount, currency, due_date, account_id, status, category, notes,
          recurrence, recurrence_day, recurrence_end, paid_at, source_type, source_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $newId,
        trim($data['label'] ?? 'Sans titre'),
        (float)($data['amount'] ?? 0),
        $data['currency']      ?? 'CHF',
        $data['dueDate']       ?? null,
        $data['accountId']     ?? null,
        $status,
        $data['category']      ?? null,
        $data['notes']         ?? null,
        $recurrence,
        isset($data['recurrenceDay']) ? (int)$data['recurrenceDay'] : null,
        $data['recurrenceEnd'] ?? null,
        $status === 'paid' ? ($data['paidAt'] ?? date('Y-m-d H:i:s')) : null,
        $data['sourceType']    ?? null,
        $data['sourceId']      ?? null,
    ]);

    $stmt = $pdo->prepare('SELECT * FROM payables WHERE id = ?');
    $stmt->execute([$newId]);
    ok(mapPayable($stmt->fetch()));
}

if ($method === 'PUT') {
    if (!$id) fail('Missing id');
    $data = body();

    // Load current row first (needed for recurrence spawn detection)
    $stmt = $pdo->prepare('SELECT * FROM payables WHERE id = ?');
    $stmt->execute([$id]);
    $current = $stmt->fetch();
    if (!$current) fail('Payable not found', 404);

    $fields = [];
    $values = [];

    if (array_key_exists('label',         $data)) { $fields[] = 'label = ?';          $values[] = trim($data['label']); }
    if (array_key_exists('amount',        $data)) { $fields[] = 'amount = ?';         $values[] = (float)$data['amount']; }
    if (array_key_exists('currency',      $data)) { $fields[] = 'currency = ?';       $values[] = $data['currency']; }
    if (array_key_exists('dueDate',       $data)) { $fields[] = 'due_date = ?';       $values[] = $data['dueDate']; }
    if (array_key_exists('accountId',     $data)) { $fields[] = 'account_id = ?';     $values[] = $data['accountId']; }
    if (array_key_exists('category',      $data)) { $fields[] = 'category = ?';       $values[] = $data['category']; }
    if (array_key_exists('notes',         $data)) { $fields[] = 'notes = ?';          $values[] = $data['notes']; }
    if (array_key_exists('recurrence',    $data)) {
        $r = in_array($data['recurrence'], ['none','weekly','monthly','quarterly','yearly'], true) ? $data['recurrence'] : 'none';
        $fields[] = 'recurrence = ?'; $values[] = $r;
    }
    if (array_key_exists('recurrenceDay', $data)) { $fields[] = 'recurrence_day = ?'; $values[] = isset($data['recurrenceDay']) ? (int)$data['recurrenceDay'] : null; }
    if (array_key_exists('recurrenceEnd', $data)) { $fields[] = 'recurrence_end = ?'; $values[] = $data['recurrenceEnd']; }

    $statusChanged = false;
    $newStatus = $current['status'];
    if (array_key_exists('status', $data) && in_array($data['status'], ['pending','scheduled','paid','cancelled'], true)) {
        $newStatus = $data['status'];
        if ($newStatus !== $current['status']) {
            $statusChanged = true;
            $fields[] = 'status = ?'; $values[] = $newStatus;
            if ($newStatus === 'paid') {
                $fields[] = 'paid_at = ?'; $values[] = $data['paidAt'] ?? date('Y-m-d H:i:s');
            } else if ($current['status'] === 'paid') {
                $fields[] = 'paid_at = ?'; $values[] = null;
            }
        }
    } else if (array_key_exists('paidAt', $data)) {
        $fields[] = 'paid_at = ?'; $values[] = $data['paidAt'];
    }

    if (!empty($fields)) {
        $values[] = $id;
        $pdo->prepare('UPDATE payables SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($values);
    }

    $stmt = $pdo->prepare('SELECT * FROM payables WHERE id = ?');
    $stmt->execute([$id]);
    $updated = $stmt->fetch();

    // Auto-spawn next recurring payable when this one transitions to paid.
    $spawned = null;
    $recurrence    = $data['recurrence']    ?? $updated['recurrence'];
    $recurrenceDay = array_key_exists('recurrenceDay', $data) ? (isset($data['recurrenceDay']) ? (int)$data['recurrenceDay'] : null) : (isset($updated['recurrence_day']) ? (int)$updated['recurrence_day'] : null);
    $recurrenceEnd = $data['recurrenceEnd'] ?? $updated['recurrence_end'];
    if ($statusChanged && $newStatus === 'paid' && $recurrence !== 'none') {
        $nextDue = nextDueDate($updated['due_date'], $recurrence, $recurrenceDay, $recurrenceEnd);
        if ($nextDue) {
            // Avoid duplicate spawn if a future instance already exists for this source chain.
            $check = $pdo->prepare(
                'SELECT id FROM payables
                 WHERE label = ? AND amount = ? AND recurrence = ? AND due_date = ?
                 AND status IN ("pending","scheduled") LIMIT 1'
            );
            $check->execute([$updated['label'], $updated['amount'], $recurrence, $nextDue]);
            if (!$check->fetch()) {
                $spawnId = uuid();
                $pdo->prepare(
                    'INSERT INTO payables
                     (id, label, amount, currency, due_date, account_id, status, category, notes,
                      recurrence, recurrence_day, recurrence_end, source_type, source_id)
                     VALUES (?, ?, ?, ?, ?, ?, "pending", ?, ?, ?, ?, ?, ?, ?)'
                )->execute([
                    $spawnId,
                    $updated['label'],
                    (float)$updated['amount'],
                    $updated['currency'] ?? 'CHF',
                    $nextDue,
                    $updated['account_id'],
                    $updated['category'],
                    $updated['notes'],
                    $recurrence,
                    $recurrenceDay,
                    $recurrenceEnd,
                    'recurrence',
                    $id,
                ]);
                $stmt = $pdo->prepare('SELECT * FROM payables WHERE id = ?');
                $stmt->execute([$spawnId]);
                $spawned = mapPayable($stmt->fetch());
            }
        }
    }

    $payload = mapPayable($updated);
    if ($spawned) { $payload['spawned'] = $spawned; }
    ok($payload);
}

if ($method === 'DELETE') {
    if (!$id) fail('Missing id');
    $pdo->prepare('DELETE FROM payables WHERE id = ?')->execute([$id]);
    ok();
}
