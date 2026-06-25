-- Link one Trésorerie account to the pasted bank statement: when bank_feed = 1
-- the account's balance is auto-synced from the most recent bank_transactions
-- running balance (balance_after). See public/api/_bank_feed.php.
-- The endpoints self-migrate this column too; this file is for fresh installs.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS bank_feed TINYINT(1) NOT NULL DEFAULT 0;
