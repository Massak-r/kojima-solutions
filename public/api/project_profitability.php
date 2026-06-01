<?php
// Per-project profitability inputs. Returns raw aggregates only; the frontend
// turns hours into money using the company/client hourly rate (the rate lives
// client-side in CompanySettings). Cost model is labor-based — direct costs
// aren't allocated per project yet (payables have no project link).
// GET /api/project_profitability.php   (admin session)
require_once __DIR__ . '/_bootstrap.php';
requireAdminSession();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') fail('GET only', 405);

// ── Tracked seconds per project ──────────────────────────────────────────────
// Mirrors suggest_quote_lines.php's attribution (a session split across several
// subtasks divides its duration equally) but spans every project and counts
// billed sessions too — profitability is about total effort, not just unbilled.
$secByProject = [];
try {
    $sql = "
      SELECT project_id, SUM(attributed_sec) AS total_sec FROM (
        SELECT parent.linked_project_id AS project_id, (s.duration_sec / cnt.n) AS attributed_sec
        FROM objective_session_subtasks pivot
        JOIN objective_sessions s ON s.id = pivot.session_id
        JOIN todo_subtasks st     ON st.id = pivot.subtask_id
        JOIN admin_todos parent   ON parent.id = st.parent_id
        JOIN (SELECT session_id, COUNT(*) AS n FROM objective_session_subtasks GROUP BY session_id) cnt
          ON cnt.session_id = pivot.session_id
        WHERE parent.linked_project_id IS NOT NULL
          AND st.source = 'admin' AND s.source = 'admin'
          AND s.ended_at IS NOT NULL AND s.duration_sec IS NOT NULL
        UNION ALL
        SELECT parent.linked_project_id AS project_id, s.duration_sec AS attributed_sec
        FROM objective_sessions s
        JOIN admin_todos parent ON parent.id = s.objective_id
        WHERE parent.linked_project_id IS NOT NULL
          AND s.source = 'admin' AND s.ended_at IS NOT NULL AND s.duration_sec IS NOT NULL
          AND s.id NOT IN (SELECT session_id FROM objective_session_subtasks)
      ) t
      GROUP BY project_id";
    foreach ($pdo->query($sql) as $row) {
        $secByProject[$row['project_id']] = (float)$row['total_sec'];
    }
} catch (Throwable $e) {
    error_log('project_profitability tracked-seconds failed: ' . $e->getMessage());
}

// ── Estimated hours per project (sum of timeline-task estimates) ──────────────
$estByProject = [];
try {
    foreach ($pdo->query("SELECT project_id, SUM(estimated_hours) AS est FROM tasks WHERE estimated_hours IS NOT NULL GROUP BY project_id") as $row) {
        $estByProject[$row['project_id']] = (float)$row['est'];
    }
} catch (Throwable $e) {
    error_log('project_profitability est-hours failed: ' . $e->getMessage());
}

// ── Per-client hourly-rate override (nullable) ───────────────────────────────
$rateByClient = [];
try {
    foreach ($pdo->query("SELECT id, hourly_rate FROM clients WHERE hourly_rate IS NOT NULL") as $row) {
        $rateByClient[$row['id']] = (float)$row['hourly_rate'];
    }
} catch (Throwable $e) {
    error_log('project_profitability client-rate failed: ' . $e->getMessage());
}

// ── Allocated direct costs per project (out-direction payables, non-cancelled) ─
// payables.project_id may not exist yet on a lagging DB; the try/catch keeps the
// endpoint alive (costs just fall back to 0 until payables.php self-heals it).
$costByProject = [];
try {
    $sql = "SELECT project_id, SUM(amount) AS total FROM payables
            WHERE direction = 'out' AND status <> 'cancelled' AND project_id IS NOT NULL
            GROUP BY project_id";
    foreach ($pdo->query($sql) as $row) {
        $costByProject[$row['project_id']] = (float)$row['total'];
    }
} catch (Throwable $e) {
    error_log('project_profitability allocated-costs failed: ' . $e->getMessage());
}

// SELECT * so a lagging schema (e.g. `kind` not yet migrated) can't 500 the
// endpoint — missing columns just fall back to defaults below.
$out = [];
foreach ($pdo->query("SELECT * FROM projects ORDER BY created_at DESC") as $p) {
    $pid       = $p['id'];
    $sec       = $secByProject[$pid] ?? 0.0;
    $clientId  = $p['client_id'] ?? null;
    $out[] = [
        'id'             => $pid,
        'title'          => $p['title'],
        'client'         => $p['client'] ?? null,
        'clientId'       => $clientId,
        'kind'           => $p['kind'] ?? 'client',
        'status'         => $p['status'] ?? null,
        'paymentStatus'  => $p['payment_status'] ?? null,
        'initialQuote'   => $p['initial_quote'] ?? null,
        'revisedQuote'   => $p['revised_quote'] ?? null,
        'clientRate'     => ($clientId !== null && isset($rateByClient[$clientId])) ? $rateByClient[$clientId] : null,
        'trackedHours'   => round($sec / 3600, 2),
        'estimatedHours' => isset($estByProject[$pid]) ? round($estByProject[$pid], 2) : null,
        'allocatedCosts' => $costByProject[$pid] ?? 0.0,
    ];
}

ok($out);
