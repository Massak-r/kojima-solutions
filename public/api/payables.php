<?php
require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

const PAYABLE_RECURRENCE_VALUES = ['none','weekly','monthly','bimonthly','quarterly','biannual','yearly'];
const PAYABLE_DIRECTION_VALUES  = ['out','in'];
const PAYABLE_STATUS_VALUES     = ['pending','scheduled','paid','cancelled'];
const PAYABLE_COMMITMENT_VALUES = ['committed','forecast'];

// Self-healing schema: allocate a payable to a project. Older prod DBs predate
// this column, so add it on the fly (idempotent) rather than requiring a manual
// migration run — same pattern projects.php uses for `kind`.
try {
    $payCols = $pdo->query('SHOW COLUMNS FROM payables')->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('project_id', $payCols, true)) {
        $pdo->exec('ALTER TABLE payables ADD COLUMN project_id VARCHAR(36) NULL AFTER account_id');
    }
} catch (Throwable $e) { /* column already present or DB lagging — ignore */ }

function mapPayable(array $row): array {
    return [
        'id'                 => $row['id'],
        'label'              => $row['label'],
        'amount'             => (float)$row['amount'],
        'currency'           => $row['currency'] ?? 'CHF',
        'direction'          => $row['direction'] ?? 'out',
        'dueDate'            => $row['due_date'] ?? null,
        'accountId'          => $row['account_id'] ?? null,
        'projectId'          => $row['project_id'] ?? null,
        'status'             => $row['status'],
        'commitment'         => $row['commitment'] ?? 'committed',
        'category'           => $row['category'] ?? null,
        'notes'              => $row['notes'] ?? null,
        'recurrence'         => $row['recurrence'] ?? 'none',
        'recurrenceDay'      => isset($row['recurrence_day']) ? (int)$row['recurrence_day'] : null,
        'recurrenceEnd'      => $row['recurrence_end'] ?? null,
        'adjustmentAmount'   => isset($row['adjustment_amount']) && $row['adjustment_amount'] !== null ? (float)$row['adjustment_amount'] : null,
        'adjustmentDueDate'  => $row['adjustment_due_date'] ?? null,
        'paidAt'             => $row['paid_at'] ?? null,
        'sourceType'         => $row['source_type'] ?? null,
        'sourceId'           => $row['source_id'] ?? null,
        'createdAt'          => $row['created_at'],
        'updatedAt'          => $row['updated_at'],
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
        'bimonthly' => $base->modify('+2 months'),
        'quarterly' => $base->modify('+3 months'),
        'biannual'  => $base->modify('+6 months'),
        'yearly'    => $base->modify('+1 year'),
        default     => null,
    };
    if (!$next) return null;
    // Snap to recurrence_day for any month-or-longer cadence if set.
    if ($recurrenceDay && in_array($recurrence, ['monthly','bimonthly','quarterly','biannual','yearly'], true)) {
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
    $status     = $_GET['status']     ?? null;
    $accountId  = $_GET['accountId']  ?? null;
    $projectId  = $_GET['projectId']  ?? null;
    $direction  = $_GET['direction']  ?? null;
    $commitment = $_GET['commitment'] ?? null;
    $where      = [];
    $params     = [];
    if ($status && in_array($status, PAYABLE_STATUS_VALUES, true)) {
        $where[] = 'status = ?'; $params[] = $status;
    }
    if ($accountId) {
        $where[] = 'account_id = ?'; $params[] = $accountId;
    }
    if ($projectId) {
        $where[] = 'project_id = ?'; $params[] = $projectId;
    }
    if ($direction && in_array($direction, PAYABLE_DIRECTION_VALUES, true)) {
        $where[] = 'direction = ?'; $params[] = $direction;
    }
    if ($commitment && in_array($commitment, PAYABLE_COMMITMENT_VALUES, true)) {
        $where[] = 'commitment = ?'; $params[] = $commitment;
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
    if (!in_array($recurrence, PAYABLE_RECURRENCE_VALUES, true)) $recurrence = 'none';
    $status = $data['status'] ?? 'pending';
    if (!in_array($status, PAYABLE_STATUS_VALUES, true)) $status = 'pending';
    $direction = $data['direction'] ?? 'out';
    if (!in_array($direction, PAYABLE_DIRECTION_VALUES, true)) $direction = 'out';
    $commitment = $data['commitment'] ?? 'committed';
    if (!in_array($commitment, PAYABLE_COMMITMENT_VALUES, true)) $commitment = 'committed';

    $pdo->prepare(
        'INSERT INTO payables
         (id, label, amount, currency, direction, due_date, account_id, project_id, status, commitment, category, notes,
          recurrence, recurrence_day, recurrence_end, adjustment_amount, adjustment_due_date,
          paid_at, source_type, source_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $newId,
        trim($data['label'] ?? 'Sans titre'),
        (float)($data['amount'] ?? 0),
        $data['currency']      ?? 'CHF',
        $direction,
        $data['dueDate']       ?? null,
        $data['accountId']     ?? null,
        $data['projectId']     ?? null,
        $status,
        $commitment,
        $data['category']      ?? null,
        $data['notes']         ?? null,
        $recurrence,
        isset($data['recurrenceDay']) ? (int)$data['recurrenceDay'] : null,
        $data['recurrenceEnd']        ?? null,
        isset($data['adjustmentAmount']) && $data['adjustmentAmount'] !== null ? (float)$data['adjustmentAmount'] : null,
        $data['adjustmentDueDate']    ?? null,
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

    if (array_key_exists('label',             $data)) { $fields[] = 'label = ?';               $values[] = trim($data['label']); }
    if (array_key_exists('amount',            $data)) { $fields[] = 'amount = ?';              $values[] = (float)$data['amount']; }
    if (array_key_exists('currency',          $data)) { $fields[] = 'currency = ?';            $values[] = $data['currency']; }
    if (array_key_exists('direction',         $data)) {
        $d = in_array($data['direction'], PAYABLE_DIRECTION_VALUES, true) ? $data['direction'] : 'out';
        $fields[] = 'direction = ?'; $values[] = $d;
    }
    if (array_key_exists('commitment',        $data)) {
        $c = in_array($data['commitment'], PAYABLE_COMMITMENT_VALUES, true) ? $data['commitment'] : 'committed';
        $fields[] = 'commitment = ?'; $values[] = $c;
    }
    if (array_key_exists('dueDate',           $data)) { $fields[] = 'due_date = ?';            $values[] = $data['dueDate']; }
    if (array_key_exists('accountId',         $data)) { $fields[] = 'account_id = ?';          $values[] = $data['accountId']; }
    if (array_key_exists('projectId',         $data)) { $fields[] = 'project_id = ?';          $values[] = $data['projectId'] ?: null; }
    if (array_key_exists('category',          $data)) { $fields[] = 'category = ?';            $values[] = $data['category']; }
    if (array_key_exists('notes',             $data)) { $fields[] = 'notes = ?';               $values[] = $data['notes']; }
    if (array_key_exists('recurrence',        $data)) {
        $r = in_array($data['recurrence'], PAYABLE_RECURRENCE_VALUES, true) ? $data['recurrence'] : 'none';
        $fields[] = 'recurrence = ?'; $values[] = $r;
    }
    if (array_key_exists('recurrenceDay',     $data)) { $fields[] = 'recurrence_day = ?';      $values[] = isset($data['recurrenceDay']) ? (int)$data['recurrenceDay'] : null; }
    if (array_key_exists('recurrenceEnd',     $data)) { $fields[] = 'recurrence_end = ?';      $values[] = $data['recurrenceEnd']; }
    if (array_key_exists('adjustmentAmount',  $data)) { $fields[] = 'adjustment_amount = ?';   $values[] = $data['adjustmentAmount'] !== null ? (float)$data['adjustmentAmount'] : null; }
    if (array_key_exists('adjustmentDueDate', $data)) { $fields[] = 'adjustment_due_date = ?'; $values[] = $data['adjustmentDueDate']; }

    $statusChanged = false;
    $newStatus = $current['status'];
    if (array_key_exists('status', $data) && in_array($data['status'], PAYABLE_STATUS_VALUES, true)) {
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
                     (id, label, amount, currency, direction, due_date, account_id, project_id, status, commitment, category, notes,
                      recurrence, recurrence_day, recurrence_end, adjustment_amount, adjustment_due_date,
                      source_type, source_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, "pending", ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                )->execute([
                    $spawnId,
                    $updated['label'],
                    (float)$updated['amount'],
                    $updated['currency'] ?? 'CHF',
                    $updated['direction'] ?? 'out',
                    $nextDue,
                    $updated['account_id'],
                    $updated['project_id'] ?? null,
                    $updated['commitment'] ?? 'committed',
                    $updated['category'],
                    $updated['notes'],
                    $recurrence,
                    $recurrenceDay,
                    $recurrenceEnd,
                    isset($updated['adjustment_amount']) && $updated['adjustment_amount'] !== null ? (float)$updated['adjustment_amount'] : null,
                    $updated['adjustment_due_date'] ?? null,
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
