-- Time-tracking -> invoice lines loop closure.
-- Adds:
--   * objective_sessions.billed_at / billed_quote_id — marks a focus session
--     as already invoiced so it stops appearing in suggest_quote_lines.
--   * clients.hourly_rate — per-client override of the company default rate.

ALTER TABLE objective_sessions ADD COLUMN billed_at DATETIME DEFAULT NULL;

ALTER TABLE objective_sessions ADD COLUMN billed_quote_id VARCHAR(36) DEFAULT NULL;

CREATE INDEX idx_sessions_billed ON objective_sessions (billed_at);

ALTER TABLE clients ADD COLUMN hourly_rate DECIMAL(10,2) DEFAULT NULL;
