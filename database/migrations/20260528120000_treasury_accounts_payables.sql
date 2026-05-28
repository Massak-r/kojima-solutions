-- Trésorerie v2 : comptes + payables + lien account_id sur expenses/personal_costs.
-- Manual snapshot model : l'utilisateur met à jour les soldes manuellement (pas de CAMT import yet).
-- Payables supportent one-off OU auto-récurrence (mensuel/hebdo/annuel/jours-X).

CREATE TABLE IF NOT EXISTS accounts (
  id                   VARCHAR(36)   NOT NULL,
  name                 VARCHAR(255)  NOT NULL,
  type                 ENUM('perso','entreprise') NOT NULL DEFAULT 'perso',
  institution          VARCHAR(255)  NULL,
  currency             VARCHAR(8)    NOT NULL DEFAULT 'CHF',
  balance              DECIMAL(14,2) NOT NULL DEFAULT 0,
  balance_updated_at   DATETIME      NULL,
  sort_order           INT           NOT NULL DEFAULT 0,
  is_archived          TINYINT(1)    NOT NULL DEFAULT 0,
  notes                TEXT          NULL,
  created_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_accounts_type (type),
  INDEX idx_accounts_archived (is_archived)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payables (
  id              VARCHAR(36)   NOT NULL,
  label           VARCHAR(255)  NOT NULL,
  amount          DECIMAL(14,2) NOT NULL,
  currency        VARCHAR(8)    NOT NULL DEFAULT 'CHF',
  due_date        DATE          NULL,
  account_id      VARCHAR(36)   NULL,
  status          ENUM('pending','scheduled','paid','cancelled') NOT NULL DEFAULT 'pending',
  category        VARCHAR(64)   NULL,
  notes           TEXT          NULL,
  recurrence      ENUM('none','weekly','monthly','quarterly','yearly') NOT NULL DEFAULT 'none',
  recurrence_day  TINYINT       NULL,
  recurrence_end  DATE          NULL,
  paid_at         DATETIME      NULL,
  source_type     VARCHAR(32)   NULL,
  source_id       VARCHAR(36)   NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_payables_status (status),
  INDEX idx_payables_due (due_date),
  INDEX idx_payables_account (account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE expenses        ADD COLUMN account_id VARCHAR(36) NULL;
ALTER TABLE personal_costs  ADD COLUMN account_id VARCHAR(36) NULL;

CREATE INDEX idx_expenses_account ON expenses (account_id);
CREATE INDEX idx_personal_costs_account ON personal_costs (account_id);
