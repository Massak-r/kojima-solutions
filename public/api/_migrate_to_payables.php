<?php
// One-shot data migration: payment_plans + personal_costs → payables.
// Plans absorb into payables via the new direction/adjustment columns; recurring
// personal_costs become recurring 'out' payables.
//
// Idempotent: skips rows that already have a matching (source_type, source_id)
// entry in payables. Source rows in payment_plans / personal_costs are NOT
// touched — the user can verify the resulting payables before deleting the
// originals.
//
// Trigger: POST /api/_migrate_to_payables.php
// Auth: admin session (CSRF) OR X-API-Key.

require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('POST only', 405);

const FREQ_TO_RECURRENCE = [
    'weekly'    => 'weekly',
    'monthly'   => 'monthly',
    'bimonthly' => 'bimonthly',
    'quarterly' => 'quarterly',
    'biannual'  => 'biannual',
    'yearly'    => 'yearly',
];
const FREQ_DAYS = [
    'weekly'    => 7,
    'monthly'   => 30,
    'bimonthly' => 61,
    'quarterly' => 91,
    'biannual'  => 182,
    'yearly'    => 365,
];

$existing = $pdo->query(
    "SELECT source_type, source_id FROM payables
     WHERE source_type IN ('plan','personal_cost')"
)->fetchAll();
$seen = [];
foreach ($existing as $row) {
    $seen[$row['source_type'] . ':' . $row['source_id']] = true;
}

$insert = $pdo->prepare(
    'INSERT INTO payables
     (id, label, amount, currency, direction, due_date, account_id, status, category, notes,
      recurrence, recurrence_day, recurrence_end, adjustment_amount, adjustment_due_date,
      source_type, source_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);

$plansMigrated = [];
$plansSkipped  = [];
$plansRows = $pdo->query('SELECT * FROM payment_plans')->fetchAll();
foreach ($plansRows as $plan) {
    $key = 'plan:' . $plan['id'];
    if (isset($seen[$key])) { $plansSkipped[] = $plan['name']; continue; }

    $type   = $plan['type'];
    $direction = ($type === 'income') ? 'in' : 'out';
    $startDt = new DateTimeImmutable($plan['start_date']);
    $recurrence = 'monthly';
    $recurrenceDay = (int)$startDt->format('j');
    $recurrenceEnd = null;
    $adjustment = null;
    $adjustmentDueDate = null;
    $paidMonths = json_decode($plan['paid_months'] ?? '[]', true) ?? [];
    $totalMonths = max(1, (int)$plan['total_months']);

    if ($type === 'installment' || $type === 'recurring-adjusted') {
        // Bounded recurrence — last occurrence sits at startDate + (totalMonths-1) months.
        $endDt = $startDt->modify('+' . ($totalMonths - 1) . ' months');
        $recurrenceEnd = $endDt->format('Y-m-d');
    }
    if ($type === 'recurring-adjusted' && $plan['adjustment'] !== null) {
        $adjustment = (float)$plan['adjustment'];
        $adjustmentDueDate = $recurrenceEnd;  // applies on the final occurrence
    }

    // dueDate: first UNPAID month for installment, or just the start date for ongoing.
    $nextIdx = 0;
    if (!empty($paidMonths) && ($type === 'installment' || $type === 'recurring-adjusted')) {
        for ($i = 0; $i < $totalMonths; $i++) {
            if (!in_array($i, $paidMonths, true)) { $nextIdx = $i; break; }
            $nextIdx = $i + 1;
        }
    }
    if ($nextIdx >= $totalMonths) {
        // Fully paid; skip — no future obligation remains.
        $plansSkipped[] = $plan['name'] . ' (terminé)';
        continue;
    }
    $dueDate = $startDt->modify('+' . $nextIdx . ' months')->format('Y-m-d');

    $insert->execute([
        uuid(),
        $plan['name'],
        (float)$plan['monthly_amount'],
        'CHF',
        $direction,
        $dueDate,
        null,            // account_id — plans didn't track it
        'pending',
        $plan['category'],
        $plan['notes'],
        $recurrence,
        $recurrenceDay,
        $recurrenceEnd,
        $adjustment,
        $adjustmentDueDate,
        'plan',
        $plan['id'],
    ]);
    $plansMigrated[] = $plan['name'];
}

$costsMigrated = [];
$costsSkipped  = [];
$costsRows = $pdo->query('SELECT * FROM personal_costs')->fetchAll();
foreach ($costsRows as $cost) {
    $key = 'personal_cost:' . $cost['id'];
    if (isset($seen[$key])) { $costsSkipped[] = $cost['name']; continue; }

    $freq = $cost['frequency'];
    if (!isset(FREQ_TO_RECURRENCE[$freq])) { $costsSkipped[] = $cost['name'] . ' (fréquence inconnue)'; continue; }
    $recurrence = FREQ_TO_RECURRENCE[$freq];

    // Next due date = last_paid + frequency_days, or today.
    if (!empty($cost['last_paid'])) {
        $next = (new DateTimeImmutable($cost['last_paid']))->modify('+' . FREQ_DAYS[$freq] . ' days');
        $dueDate = $next->format('Y-m-d');
    } else {
        $dueDate = (new DateTimeImmutable('today'))->format('Y-m-d');
    }
    // Day-of-month for monthly+ cadence
    $recurrenceDay = null;
    if (in_array($recurrence, ['monthly','bimonthly','quarterly','biannual','yearly'], true)) {
        $recurrenceDay = (int)(new DateTimeImmutable($dueDate))->format('j');
    }

    $insert->execute([
        uuid(),
        $cost['name'],
        (float)$cost['amount'],
        'CHF',
        'out',
        $dueDate,
        $cost['account_id'] ?? null,
        'pending',
        $cost['category'],
        null,            // notes
        $recurrence,
        $recurrenceDay,
        null,            // recurrence_end — costs are open-ended
        null,            // adjustment_amount
        null,            // adjustment_due_date
        'personal_cost',
        $cost['id'],
    ]);
    $costsMigrated[] = $cost['name'];
}

ok([
    'plans_migrated' => $plansMigrated,
    'plans_skipped'  => $plansSkipped,
    'costs_migrated' => $costsMigrated,
    'costs_skipped'  => $costsSkipped,
]);
