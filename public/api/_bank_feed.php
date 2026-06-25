<?php
// Shared helpers for the "compte alimenté par le relevé bancaire" link.
//
// One account can be flagged bank_feed = 1. Its balance is then kept in sync
// with the most recent pasted bank transaction's running balance
// (bank_transactions.balance_after) — so the Trésorerie "compte entreprise"
// reflects the real cash position as of the last statement paste, instead of a
// manually-typed snapshot that drifts.
//
// Used by accounts.php (set the flag, initial sync) and bank_transactions.php
// (re-sync on every paste / delete).

/** Idempotently add the bank_feed column. Safe to call on every request. */
function ensureBankFeedColumn(PDO $pdo): void {
    static $done = false;
    if ($done) return;
    $done = true;
    try { $pdo->exec("ALTER TABLE accounts ADD COLUMN bank_feed TINYINT(1) NOT NULL DEFAULT 0"); } catch (Throwable $e) {}
}

/**
 * Current bank balance derived from stored transactions: the balance_after of
 * the most recent transaction. "Most recent" = the global MAX(booking_date)
 * (so pasting an OLDER statement later never moves the balance backward).
 *
 * When that day has several transactions we resolve the day's *final* balance
 * via the running-balance chain: the closing balance is the one balance_after
 * that is not any other same-day row's pre-transaction balance
 * (balance_after - amount). Returns ['balance' => float, 'asOf' => 'Y-m-d'] or
 * null when no transaction carries a balance.
 */
function currentBankBalance(PDO $pdo): ?array {
    $maxDate = $pdo->query(
        "SELECT MAX(booking_date) FROM bank_transactions WHERE balance_after IS NOT NULL"
    )->fetchColumn();
    if (!$maxDate) return null;

    $stmt = $pdo->prepare(
        "SELECT amount, balance_after FROM bank_transactions
         WHERE booking_date = ? AND balance_after IS NOT NULL"
    );
    $stmt->execute([$maxDate]);
    $rows = $stmt->fetchAll();
    if (!$rows) return null;

    if (count($rows) === 1) {
        return ['balance' => (float)$rows[0]['balance_after'], 'asOf' => $maxDate];
    }

    // Several transactions on the closing day: the final balance is the
    // balance_after that no other row consumes as its opening balance.
    $opens = [];
    foreach ($rows as $r) {
        $open = (float)$r['balance_after'] - (float)$r['amount'];
        $opens[number_format($open, 2, '.', '')] = true;
    }
    foreach ($rows as $r) {
        $close = number_format((float)$r['balance_after'], 2, '.', '');
        if (!isset($opens[$close])) {
            return ['balance' => (float)$r['balance_after'], 'asOf' => $maxDate];
        }
    }

    // Degenerate chain (e.g. a same-day zero-sum loop): fall back to the
    // highest closing balance of the day rather than guess wrong.
    $balances = array_map(static fn($r) => (float)$r['balance_after'], $rows);
    return ['balance' => max($balances), 'asOf' => $maxDate];
}

/**
 * Push the current bank balance onto the flagged bank_feed account, if any.
 * Returns ['accountId' => …, 'balance' => float, 'asOf' => 'Y-m-d'] when it
 * updated an account, or null (no flagged account / no balance / no table yet).
 * Never throws — a missing table just yields null so callers stay robust.
 */
function syncBankFeedAccount(PDO $pdo): ?array {
    try {
        ensureBankFeedColumn($pdo);
        $acc = $pdo->query("SELECT id FROM accounts WHERE bank_feed = 1 LIMIT 1")->fetch();
        if (!$acc) return null;
        $cur = currentBankBalance($pdo);
        if ($cur === null) return null;
        $pdo->prepare("UPDATE accounts SET balance = ?, balance_updated_at = ? WHERE id = ?")
            ->execute([$cur['balance'], date('Y-m-d H:i:s'), $acc['id']]);
        return ['accountId' => $acc['id'], 'balance' => $cur['balance'], 'asOf' => $cur['asOf']];
    } catch (Throwable $e) {
        return null;
    }
}

/**
 * Mark a single account as the bank-feed account (or clear it). Setting it on
 * enforces the single-account invariant (clears the flag on every other row)
 * and immediately syncs the balance from whatever is already pasted.
 */
function setBankFeedAccount(PDO $pdo, string $id, bool $on): void {
    ensureBankFeedColumn($pdo);
    if ($on) {
        $pdo->prepare("UPDATE accounts SET bank_feed = 0 WHERE id <> ?")->execute([$id]);
        $pdo->prepare("UPDATE accounts SET bank_feed = 1 WHERE id = ?")->execute([$id]);
        syncBankFeedAccount($pdo);
    } else {
        $pdo->prepare("UPDATE accounts SET bank_feed = 0 WHERE id = ?")->execute([$id]);
    }
}
