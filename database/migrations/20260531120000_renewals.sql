-- Renewals / expiry radar: domaines, hébergement, SSL, assurances, contrats,
-- abonnements à renouveler. Surfaced as an AlertsZone card + a Trésorerie tab.
-- renewals.php also self-creates this table (CREATE TABLE IF NOT EXISTS) so the
-- feature works even before this migration is run.

CREATE TABLE IF NOT EXISTS renewals (
  id          VARCHAR(36)   NOT NULL,
  label       VARCHAR(255)  NOT NULL,
  category    VARCHAR(64)   NULL,
  expiry_date DATE          NOT NULL,
  recurrence  ENUM('none','monthly','quarterly','biannual','yearly') NOT NULL DEFAULT 'yearly',
  amount      DECIMAL(14,2) NULL,
  notes       TEXT          NULL,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_renewals_expiry (expiry_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
