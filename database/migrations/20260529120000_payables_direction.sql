-- Payables absorb income tracking + recurring-adjusted plans.
--   * direction='in' lets payables represent expected income (was payment_plans.type='income').
--   * adjustment_amount + adjustment_due_date represent a one-off correction on a recurring
--     payable (was payment_plans.type='recurring-adjusted' — e.g. impôts year-end rattrapage).
--   * recurrence enum gains 'bimonthly' and 'biannual' so personal_costs (Budget tab) can be
--     migrated 1:1 without lossy frequency rounding.

ALTER TABLE payables
  ADD COLUMN IF NOT EXISTS direction            ENUM('out','in') NOT NULL DEFAULT 'out',
  ADD COLUMN IF NOT EXISTS adjustment_amount    DECIMAL(14,2)    NULL,
  ADD COLUMN IF NOT EXISTS adjustment_due_date  DATE             NULL;

-- Widen the recurrence enum (MariaDB lets us add values via MODIFY).
ALTER TABLE payables
  MODIFY COLUMN recurrence ENUM('none','weekly','monthly','bimonthly','quarterly','biannual','yearly')
    NOT NULL DEFAULT 'none';

CREATE INDEX IF NOT EXISTS idx_payables_direction ON payables (direction);
