-- Scan triage fields for admin documents.
-- status: 'to_sort' = waiting in the scan inbox to be filed, 'filed' = archived in a folder.
-- urgent: flagged so it stays visible in the triage queue and is not forgotten.
ALTER TABLE admin_docs
  ADD COLUMN status ENUM('to_sort','filed') NOT NULL DEFAULT 'filed' AFTER category,
  ADD COLUMN urgent TINYINT(1) NOT NULL DEFAULT 0 AFTER status,
  ADD INDEX idx_admin_docs_status (status);
