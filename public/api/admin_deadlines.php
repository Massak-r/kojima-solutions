<?php
require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

// Auto-create table
$pdo->exec("CREATE TABLE IF NOT EXISTS admin_deadlines (
  id              VARCHAR(36)   NOT NULL,
  title           VARCHAR(255)  NOT NULL,
  description     TEXT          NULL,
  due_date        DATE          NOT NULL,
  category        VARCHAR(50)   NOT NULL DEFAULT 'Général',
  recurring       VARCHAR(20)   NULL,
  remind_days     INT           NOT NULL DEFAULT 7,
  completed       TINYINT(1)    NOT NULL DEFAULT 0,
  completed_at    DATETIME      NULL,
  notified        TINYINT(1)    NOT NULL DEFAULT 0,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

function mapDeadline(array $row): array {
    return [
        'id'          => $row['id'],
        'title'       => $row['title'],
        'description' => $row['description'] ?? null,
        'dueDate'     => $row['due_date'],
        'category'    => $row['category'],
        'recurring'   => $row['recurring'] ?? null,
        'remindDays'  => (int)$row['remind_days'],
        'completed'   => (bool)$row['completed'],
        'completedAt' => $row['completed_at'] ?? null,
        'notified'    => (bool)$row['notified'],
        'createdAt'   => $row['created_at'],
    ];
}

/**
 * Check deadlines that are within their remind_days window
 * and create notifications for ones not yet notified.
 */
function checkAndNotify(PDO $pdo): void {
    $today = date('Y-m-d');

    // Find deadlines that are:
    // - not completed
    // - not yet notified for this cycle
    // - due within remind_days from today
    $stmt = $pdo->prepare("
        SELECT * FROM admin_deadlines
        WHERE completed = 0
          AND notified = 0
          AND DATEDIFF(due_date, ?) <= remind_days
          AND DATEDIFF(due_date, ?) >= -30
    ");
    $stmt->execute([$today, $today]);
    $deadlines = $stmt->fetchAll();

    foreach ($deadlines as $dl) {
        $daysUntil = (int)((strtotime($dl['due_date']) - strtotime($today)) / 86400);
        $timeLabel = $daysUntil < 0
            ? 'En retard de ' . abs($daysUntil) . ' jour(s)'
            : ($daysUntil === 0 ? "Aujourd'hui" : "Dans $daysUntil jour(s)");

        // Check if notification already exists for this deadline (avoid duplicates on table re-creation)
        $check = $pdo->prepare("SELECT COUNT(*) as cnt FROM notifications WHERE task_title = ? AND project_title = 'Admin' AND created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)");
        $check->execute([$dl['title']]);
        if ((int)$check->fetch()['cnt'] > 0) {
            // Already notified recently, just mark
            $pdo->prepare("UPDATE admin_deadlines SET notified = 1 WHERE id = ?")->execute([$dl['id']]);
            continue;
        }

        // Insert notification using existing notifications table
        $notifId = uuid();
        $pdo->prepare("INSERT INTO notifications (id, project_id, project_title, task_title, client_name, question, response)
            VALUES (?, NULL, 'Admin', ?, '', ?, ?)")
            ->execute([
                $notifId,
                $dl['title'],
                'Échéance ' . $timeLabel,
                $dl['description'] ?? '',
            ]);

        // Mark as notified
        $pdo->prepare("UPDATE admin_deadlines SET notified = 1 WHERE id = ?")->execute([$dl['id']]);
    }
}

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? null;

// GET — list all deadlines + trigger notification check
if ($method === 'GET') {
    checkAndNotify($pdo);
    $rows = $pdo->query('SELECT * FROM admin_deadlines ORDER BY completed ASC, due_date ASC')->fetchAll();
    ok(array_map('mapDeadline', $rows));
}

// POST — create
if ($method === 'POST') {
    $data  = body();
    $newId = uuid();

    $pdo->prepare('INSERT INTO admin_deadlines (id, title, description, due_date, category, recurring, remind_days, completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        ->execute([
            $newId,
            $data['title']       ?? '',
            $data['description'] ?? null,
            $data['dueDate']     ?? date('Y-m-d'),
            $data['category']    ?? 'Général',
            $data['recurring']   ?? null,
            (int)($data['remindDays'] ?? 7),
            (int)($data['completed']  ?? 0),
        ]);

    $stmt = $pdo->prepare('SELECT * FROM admin_deadlines WHERE id = ?');
    $stmt->execute([$newId]);
    ok(mapDeadline($stmt->fetch()));
}

/** Prochaine occurrence STRICTEMENT future d'une échéance récurrente. */
function nextDueDate(string $from, string $recurring): string {
    $steps = [
        'weekly'    => '+1 week',
        'monthly'   => '+1 month',
        'quarterly' => '+3 months',
        'biannual'  => '+6 months',
        'yearly'    => '+1 year',
    ];
    $step  = $steps[$recurring] ?? '+1 year';
    $ts    = strtotime($from) ?: time();
    $today = strtotime(date('Y-m-d'));
    do { $ts = strtotime($step, $ts); } while ($ts <= $today);
    return date('Y-m-d', $ts);
}

// PUT — update fields
if ($method === 'PUT') {
    if (!$id) fail('Missing id');
    $cur = $pdo->prepare('SELECT * FROM admin_deadlines WHERE id = ?');
    $cur->execute([$id]);
    $existing = $cur->fetch();
    if (!$existing) fail('Deadline not found', 404);

    $data   = body();
    $fields = [];
    $values = [];

    if (array_key_exists('title',       $data)) { $fields[] = 'title = ?';       $values[] = $data['title']; }
    if (array_key_exists('description', $data)) { $fields[] = 'description = ?'; $values[] = $data['description']; }
    if (array_key_exists('dueDate',     $data)) { $fields[] = 'due_date = ?';    $values[] = $data['dueDate']; }
    if (array_key_exists('category',    $data)) { $fields[] = 'category = ?';    $values[] = $data['category']; }
    if (array_key_exists('recurring',   $data)) { $fields[] = 'recurring = ?';   $values[] = $data['recurring']; }
    if (array_key_exists('remindDays',  $data)) { $fields[] = 'remind_days = ?'; $values[] = (int)$data['remindDays']; }
    if (array_key_exists('completed',   $data)) {
        if ($data['completed'] && !empty($existing['recurring'])) {
            // « Faite » sur une récurrente = avancer à la prochaine occurrence,
            // pas la tuer : completed reste 0, la date et le rappel repartent.
            $fields[] = 'due_date = ?';
            $values[] = nextDueDate($existing['due_date'], $existing['recurring']);
            $fields[] = 'completed = 0';
            $fields[] = 'completed_at = NULL';
            $fields[] = 'notified = 0';
        } else {
            $fields[] = 'completed = ?';
            $values[] = (int)$data['completed'];
            if ($data['completed']) {
                $fields[] = 'completed_at = NOW()';
            } else {
                $fields[] = 'completed_at = NULL';
            }
        }
    }
    if (array_key_exists('notified',    $data)) { $fields[] = 'notified = ?';    $values[] = (int)$data['notified']; }

    if (!empty($fields)) {
        $values[] = $id;
        $pdo->prepare('UPDATE admin_deadlines SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($values);
    }

    $stmt = $pdo->prepare('SELECT * FROM admin_deadlines WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) fail('Deadline not found', 404);
    ok(mapDeadline($row));
}

// DELETE
if ($method === 'DELETE') {
    if (!$id) fail('Missing id');
    $pdo->prepare('DELETE FROM admin_deadlines WHERE id = ?')->execute([$id]);
    ok();
}
