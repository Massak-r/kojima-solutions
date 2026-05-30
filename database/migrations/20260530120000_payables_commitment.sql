-- Payables gain a commitment flag so the À payer tab can filter firm
-- obligations from projections:
--   * 'committed' (Obligatoire) — a real, due obligation: loyer, impôts, crédit…
--   * 'forecast'  (Prévision)   — anticipated / estimated, not yet certain.
-- Defaults to 'committed' so existing rows (entered as real things to pay)
-- keep their meaning. IF NOT EXISTS keeps the migration idempotent.

ALTER TABLE payables
  ADD COLUMN IF NOT EXISTS commitment ENUM('committed','forecast') NOT NULL DEFAULT 'committed';

CREATE INDEX IF NOT EXISTS idx_payables_commitment ON payables (commitment);
