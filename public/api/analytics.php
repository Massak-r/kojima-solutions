<?php
require_once __DIR__ . '/_bootstrap.php';

// ── Auto-migrate ────────────────────────────────────────────────
$pdo->exec("CREATE TABLE IF NOT EXISTS analytics_events (
  id VARCHAR(36) PRIMARY KEY,
  visitor_hash VARCHAR(64) NOT NULL,
  session_id VARCHAR(36) NOT NULL,
  event_name VARCHAR(100) NOT NULL DEFAULT 'pageview',
  page_path VARCHAR(500) NOT NULL,
  referrer_domain VARCHAR(255) DEFAULT NULL,
  viewport_w SMALLINT UNSIGNED DEFAULT NULL,
  viewport_h SMALLINT UNSIGNED DEFAULT NULL,
  language VARCHAR(10) DEFAULT NULL,
  props_json TEXT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created_event (created_at, event_name),
  INDEX idx_visitor (visitor_hash, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

$method = $_SERVER['REQUEST_METHOD'];

// ── POST: record event (public, no auth) ────────────────────────
if ($method === 'POST') {
    $d = body();
    $event   = substr(trim($d['event'] ?? 'pageview'), 0, 100);
    $page    = substr(trim($d['page'] ?? '/'), 0, 500);
    $ref     = trim($d['referrer'] ?? '');
    $vw      = isset($d['vw']) ? (int)$d['vw'] : null;
    $vh      = isset($d['vh']) ? (int)$d['vh'] : null;
    $lang    = substr(trim($d['lang'] ?? ''), 0, 10);
    $session = substr(trim($d['session'] ?? ''), 0, 36);
    $props   = isset($d['props']) ? json_encode($d['props']) : null;

    // Daily rotating visitor hash (IP never stored)
    $secret = defined('ANALYTICS_SECRET') ? ANALYTICS_SECRET : 'kojima-default-secret';
    $visitorHash = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . date('Y-m-d') . $secret);

    // Extract domain only from referrer for privacy
    $refDomain = null;
    if ($ref) {
        $parsed = parse_url($ref);
        $refDomain = $parsed['host'] ?? null;
        // Strip own domain
        if ($refDomain === 'kojima-solutions.ch' || $refDomain === 'www.kojima-solutions.ch') {
            $refDomain = null;
        }
    }

    // Basic rate limit: max 200 events per visitor per day
    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM analytics_events WHERE visitor_hash = ? AND created_at >= CURDATE()");
    $countStmt->execute([$visitorHash]);
    if ((int)$countStmt->fetchColumn() >= 200) {
        ok(['ok' => true]); // silently accept but don't store
    }

    $id = uuid();
    $stmt = $pdo->prepare("INSERT INTO analytics_events (id, visitor_hash, session_id, event_name, page_path, referrer_domain, viewport_w, viewport_h, language, props_json)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$id, $visitorHash, $session, $event, $page, $refDomain, $vw, $vh, $lang, $props]);
    ok();
}

// ── GET: aggregated data (auth required) ─────────────────────────
if ($method === 'GET') {
    requireAdminSession();

    $period = $_GET['period'] ?? '7d';
    $days = match ($period) {
        'today' => 0,
        '30d'   => 30,
        default => 7,
    };

    $since = date('Y-m-d', strtotime("-{$days} days"));

    // Total visitors + pageviews
    $totals = $pdo->prepare("SELECT COUNT(DISTINCT visitor_hash) AS visitors, COUNT(*) AS pageviews
                             FROM analytics_events WHERE created_at >= ?");
    $totals->execute([$since]);
    $t = $totals->fetch();

    // Top pages
    $topPages = $pdo->prepare("SELECT page_path AS path, COUNT(*) AS count
                               FROM analytics_events
                               WHERE event_name = 'pageview' AND created_at >= ?
                               GROUP BY page_path ORDER BY count DESC LIMIT 10");
    $topPages->execute([$since]);

    // Funnel conversion
    $funnelStarts = $pdo->prepare("SELECT COUNT(*) FROM analytics_events
                                   WHERE event_name = 'Intake Step' AND created_at >= ?
                                   AND (props_json LIKE '%\"step\":1%' OR props_json LIKE '%\"step\": 1%')");
    $funnelStarts->execute([$since]);
    $starts = (int)$funnelStarts->fetchColumn();

    $funnelCompletes = $pdo->prepare("SELECT COUNT(*) FROM analytics_events
                                      WHERE event_name = 'Intake Complete' AND created_at >= ?");
    $funnelCompletes->execute([$since]);
    $completes = (int)$funnelCompletes->fetchColumn();

    // Daily breakdown
    $daily = $pdo->prepare("SELECT DATE(created_at) AS date,
                                   COUNT(DISTINCT visitor_hash) AS visitors,
                                   COUNT(*) AS pageviews
                            FROM analytics_events
                            WHERE created_at >= ?
                            GROUP BY DATE(created_at)
                            ORDER BY date ASC");
    $daily->execute([$since]);

    // Top referrers
    $referrers = $pdo->prepare("SELECT referrer_domain AS domain, COUNT(*) AS count
                                FROM analytics_events
                                WHERE referrer_domain IS NOT NULL AND created_at >= ?
                                GROUP BY referrer_domain ORDER BY count DESC LIMIT 10");
    $referrers->execute([$since]);

    ok([
        'visitors'  => (int)$t['visitors'],
        'pageviews' => (int)$t['pageviews'],
        'topPages'  => $topPages->fetchAll(),
        'topReferrers' => $referrers->fetchAll(),
        'funnelConversion' => [
            'starts'    => $starts,
            'completes' => $completes,
            'rate'      => $starts > 0 ? round($completes / $starts * 100, 1) : 0,
        ],
        'daily' => $daily->fetchAll(),
    ]);
}

fail('Method not allowed', 405);
