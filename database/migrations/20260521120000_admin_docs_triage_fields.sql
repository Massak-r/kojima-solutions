-- Scan triage fields for admin documents.
-- status: 'to_sort' = waiting in the scan inbox to be filed, 'filed' = archived in a folder.
-- urgent: flagged so it stays visible in the triage queue and is not forgotten.
-- Idempotent: admin_docs.php self-heals these columns on demand, so this
-- migration must stay safe to run whether or not they already exist.
ALTER TABLE admin_docs
  ADD COLUMN IF NOT EXISTS status ENUM('to_sort','filed') NOT NULL DEFAULT 'filed' AFTER category,
  ADD COLUMN IF NOT EXISTS urgent TINYINT(1) NOT NULL DEFAULT 0 AFTER status,
  ADD INDEX IF NOT EXISTS idx_admin_docs_status (status);
