-- ============================================================
-- Decision Flow — Funnel Tables Migration
-- Run: mysql -h HOST -u USER -p DB_NAME < migration_funnel.sql
-- ============================================================

-- ── Project Templates (genomes) ─────────────────────────────
CREATE TABLE IF NOT EXISTS project_templates (
  id               VARCHAR(36)    NOT NULL,
  name             VARCHAR(100)   NOT NULL,
  description      TEXT           DEFAULT NULL,
  icon             VARCHAR(50)    DEFAULT NULL,
  default_tier     VARCHAR(20)    DEFAULT NULL,
  phases_json      JSON           DEFAULT NULL,
  budget_range_min DECIMAL(10,2)  DEFAULT NULL,
  budget_range_max DECIMAL(10,2)  DEFAULT NULL,
  created_at       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Project Funnels (1 per project) ─────────────────────────
CREATE TABLE IF NOT EXISTS project_funnels (
  id                    VARCHAR(36)  NOT NULL,
  project_id            VARCHAR(36)  NOT NULL,
  template_id           VARCHAR(36)  DEFAULT NULL,
  tier                  VARCHAR(20)  DEFAULT NULL,
  status                VARCHAR(20)  NOT NULL DEFAULT 'intake',
  decision_maker_name   VARCHAR(100) DEFAULT NULL,
  decision_maker_email  VARCHAR(100) DEFAULT NULL,
  created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_project (project_id),
  CONSTRAINT fk_funnel_project
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Funnel Phases ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS funnel_phases (
  id           VARCHAR(36)    NOT NULL,
  funnel_id    VARCHAR(36)    NOT NULL,
  title        VARCHAR(200)   NOT NULL,
  description  TEXT           DEFAULT NULL,
  phase_order  INT            NOT NULL DEFAULT 0,
  budget       DECIMAL(10,2)  DEFAULT NULL,
  status       VARCHAR(20)    NOT NULL DEFAULT 'pending',
  started_at   DATETIME       DEFAULT NULL,
  completed_at DATETIME       DEFAULT NULL,
  PRIMARY KEY (id),
  INDEX idx_funnel (funnel_id),
  CONSTRAINT fk_phase_funnel
    FOREIGN KEY (funnel_id) REFERENCES project_funnels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Funnel Gates (decision points within a phase) ───────────
CREATE TABLE IF NOT EXISTS funnel_gates (
  id              VARCHAR(36)  NOT NULL,
  phase_id        VARCHAR(36)  NOT NULL,
  title           VARCHAR(200) NOT NULL,
  description     TEXT         DEFAULT NULL,
  gate_type       VARCHAR(20)  NOT NULL DEFAULT 'approval',
  gate_order      INT          NOT NULL DEFAULT 0,
  status          VARCHAR(20)  NOT NULL DEFAULT 'locked',
  deadline        DATE         DEFAULT NULL,
  revision_limit  INT          NOT NULL DEFAULT 2,
  revision_count  INT          NOT NULL DEFAULT 0,
  approved_at     DATETIME     DEFAULT NULL,
  approved_by     VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (id),
  INDEX idx_phase (phase_id),
  CONSTRAINT fk_gate_phase
    FOREIGN KEY (phase_id) REFERENCES funnel_phases(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Gate Options (choices within a 'choice' gate) ───────────
CREATE TABLE IF NOT EXISTS gate_options (
  id             VARCHAR(36)  NOT NULL,
  gate_id        VARCHAR(36)  NOT NULL,
  title          VARCHAR(200) DEFAULT NULL,
  description    TEXT         DEFAULT NULL,
  image_url      VARCHAR(500) DEFAULT NULL,
  link_url       VARCHAR(500) DEFAULT NULL,
  is_recommended TINYINT(1)   NOT NULL DEFAULT 0,
  is_selected    TINYINT(1)   NOT NULL DEFAULT 0,
  option_order   INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  INDEX idx_gate (gate_id),
  CONSTRAINT fk_option_gate
    FOREIGN KEY (gate_id) REFERENCES funnel_gates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Gate Comments (client + stakeholder feedback) ───────────
CREATE TABLE IF NOT EXISTS gate_comments (
  id           VARCHAR(36)  NOT NULL,
  gate_id      VARCHAR(36)  NOT NULL,
  author_name  VARCHAR(100) DEFAULT NULL,
  author_email VARCHAR(100) DEFAULT NULL,
  author_role  VARCHAR(20)  NOT NULL DEFAULT 'client',
  message      TEXT         NOT NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_gate (gate_id),
  CONSTRAINT fk_comment_gate
    FOREIGN KEY (gate_id) REFERENCES funnel_gates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Change Orders (scope changes on locked gates) ───────────
CREATE TABLE IF NOT EXISTS change_orders (
  id               VARCHAR(36)    NOT NULL,
  funnel_id        VARCHAR(36)    NOT NULL,
  gate_id          VARCHAR(36)    DEFAULT NULL,
  quote_id         VARCHAR(36)    DEFAULT NULL,
  title            VARCHAR(200)   NOT NULL,
  description      TEXT           DEFAULT NULL,
  cost_impact      DECIMAL(10,2)  DEFAULT NULL,
  time_impact_days INT            DEFAULT NULL,
  status           VARCHAR(20)    NOT NULL DEFAULT 'proposed',
  created_at       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at      DATETIME       DEFAULT NULL,
  PRIMARY KEY (id),
  INDEX idx_funnel (funnel_id),
  CONSTRAINT fk_co_funnel
    FOREIGN KEY (funnel_id) REFERENCES project_funnels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Intake Responses (pre-project questionnaire) ────────────
CREATE TABLE IF NOT EXISTS intake_responses (
  id                    VARCHAR(36)  NOT NULL,
  project_id            VARCHAR(36)  DEFAULT NULL,
  client_name           VARCHAR(100) DEFAULT NULL,
  client_email          VARCHAR(100) DEFAULT NULL,
  responses_json        JSON         DEFAULT NULL,
  suggested_tier        VARCHAR(20)  DEFAULT NULL,
  suggested_template_id VARCHAR(36)  DEFAULT NULL,
  status                VARCHAR(20)  NOT NULL DEFAULT 'new',
  created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
