-- ============================================================
-- Kojima Solutions — MariaDB Schema
-- Version: 2.0.0
-- Import with: mysql -h HOST -u USER -p DB_NAME < schema.sql
-- ============================================================

-- ── Projects ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS projects (
  id              VARCHAR(36)   NOT NULL,
  title           VARCHAR(255)  NOT NULL,
  client          VARCHAR(255)  DEFAULT NULL,
  client_slug     VARCHAR(100)  UNIQUE NULL,
  client_id       VARCHAR(36)   NULL,
  description     TEXT          DEFAULT NULL,
  status          ENUM('draft','in-progress','completed','on-hold') NOT NULL DEFAULT 'draft',
  start_date      DATE          DEFAULT NULL,
  end_date        DATE          DEFAULT NULL,
  initial_quote   VARCHAR(100)  DEFAULT NULL,
  revised_quote   VARCHAR(100)  DEFAULT NULL,
  invoice_number  VARCHAR(100)  DEFAULT NULL,
  payment_status  ENUM('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
  notes           TEXT          DEFAULT NULL,
  deliveries      JSON          DEFAULT NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Tasks (Timeline Steps) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS tasks (
  id          VARCHAR(36)   NOT NULL,
  project_id  VARCHAR(36)   NOT NULL,
  title       VARCHAR(255)  NOT NULL,
  description TEXT          DEFAULT NULL,
  task_order  INT           NOT NULL DEFAULT 0,
  date_label  VARCHAR(100)  DEFAULT NULL,
  color       ENUM('primary','accent','secondary','rose','sage','amber','violet') NOT NULL DEFAULT 'primary',
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_project_id (project_id),
  INDEX idx_order (task_order),
  CONSTRAINT fk_tasks_project
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Subtasks ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subtasks (
  id          VARCHAR(36)   NOT NULL,
  task_id     VARCHAR(36)   NOT NULL,
  title       VARCHAR(255)  NOT NULL,
  completed   TINYINT(1)    NOT NULL DEFAULT 0,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_task_id (task_id),
  CONSTRAINT fk_subtasks_task
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Feedback Requests (sent to client) ───────────────────────
-- type:
--   text       → client writes a text answer
--   file       → client uploads a file or pastes a link
--   validation → admin shows image(s), client approves or requests changes
--   vote       → admin shows named options, client picks favourite

CREATE TABLE IF NOT EXISTS feedback_requests (
  id            VARCHAR(36)   NOT NULL,
  task_id       VARCHAR(36)   NOT NULL,
  type          ENUM('text','file','validation','vote') NOT NULL DEFAULT 'text',
  message       TEXT          NOT NULL,
  images        JSON          DEFAULT NULL,   -- ["https://…/a.png", "https://…/b.png"]
  options_json  JSON          DEFAULT NULL,   -- [{ id, label, description, imageUrl }]
  resolved      TINYINT(1)    NOT NULL DEFAULT 0,
  response      TEXT          DEFAULT NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at  DATETIME      DEFAULT NULL,
  PRIMARY KEY (id),
  INDEX idx_task_id (task_id),
  INDEX idx_resolved (resolved),
  CONSTRAINT fk_feedback_requests_task
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Task Reviews (internal admin reviews) ────────────────────

CREATE TABLE IF NOT EXISTS task_feedbacks (
  id          VARCHAR(36)   NOT NULL,
  task_id     VARCHAR(36)   NOT NULL,
  project_id  VARCHAR(36)   NOT NULL,
  author      VARCHAR(255)  NOT NULL DEFAULT 'Anonymous',
  comment     TEXT          NOT NULL,
  status      ENUM('approved','needs-changes','pending') NOT NULL DEFAULT 'pending',
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_task_id (task_id),
  INDEX idx_project_id (project_id),
  INDEX idx_status (status),
  CONSTRAINT fk_task_feedbacks_task
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_task_feedbacks_project
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Users / Auth (future) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(36)   NOT NULL,
  email         VARCHAR(255)  NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  name          VARCHAR(255)  DEFAULT NULL,
  role          ENUM('admin','member') NOT NULL DEFAULT 'member',
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME      DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Quotes / Invoices ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quotes (
  id               VARCHAR(36)    NOT NULL,
  project_id       VARCHAR(36)    NULL,
  lang             ENUM('fr','en') NOT NULL DEFAULT 'fr',
  doc_type         ENUM('quote','invoice') NOT NULL DEFAULT 'quote',
  invoice_status   ENUM('draft','to-validate','validated','paid','on-hold') NOT NULL DEFAULT 'draft',
  quote_number     VARCHAR(100)   NOT NULL DEFAULT '',
  validity_date    DATE           DEFAULT NULL,
  project_title    VARCHAR(255)   DEFAULT NULL,
  project_desc     TEXT           DEFAULT NULL,
  conditions       TEXT           DEFAULT NULL,
  client_name      VARCHAR(255)   DEFAULT NULL,
  client_email     VARCHAR(255)   DEFAULT NULL,
  client_company   VARCHAR(255)   DEFAULT NULL,
  client_address   TEXT           DEFAULT NULL,
  line_items       JSON           NOT NULL,
  apply_tva        TINYINT(1)     NOT NULL DEFAULT 0,
  discount_enabled TINYINT(1)     NOT NULL DEFAULT 0,
  discount_type    ENUM('amount','percent') NOT NULL DEFAULT 'amount',
  discount_value   DECIMAL(10,2)  NOT NULL DEFAULT 0,
  discount_label   VARCHAR(255)   DEFAULT NULL,
  created_at       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_project_id (project_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── Clients ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id           VARCHAR(36)   NOT NULL,
  name         VARCHAR(255)  NOT NULL,
  organization VARCHAR(255)  DEFAULT NULL,
  email        VARCHAR(255)  DEFAULT NULL,
  phone        VARCHAR(100)  DEFAULT NULL,
  address      TEXT          DEFAULT NULL,
  notes        TEXT          DEFAULT NULL,
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Todos (admin personal to-do list) ────────────────────────

CREATE TABLE IF NOT EXISTS todos (
  id         VARCHAR(36)  NOT NULL,
  text       TEXT         NOT NULL,
  completed  TINYINT(1)   NOT NULL DEFAULT 0,
  sort_order INT          NOT NULL DEFAULT 0,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Notifications (pending email digest queue) ───────────────

CREATE TABLE IF NOT EXISTS notifications (
  id            VARCHAR(36)   NOT NULL,
  project_id    VARCHAR(36)   NULL,
  project_title VARCHAR(255)  NOT NULL DEFAULT '',
  task_title    VARCHAR(255)  NOT NULL DEFAULT '',
  client_name   VARCHAR(255)  NOT NULL DEFAULT '',
  question      TEXT          NOT NULL DEFAULT '',
  response      TEXT          NOT NULL DEFAULT '',
  sent          TINYINT(1)    NOT NULL DEFAULT 0,
  sent_at       DATETIME      NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_sent (sent),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Personal Todos ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS personal_todos (
  id         VARCHAR(36)  NOT NULL,
  text       TEXT         NOT NULL,
  completed  TINYINT(1)   NOT NULL DEFAULT 0,
  sort_order INT          NOT NULL DEFAULT 0,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Personal Costs (recurring expenses) ──────────────────────

CREATE TABLE IF NOT EXISTS personal_costs (
  id         VARCHAR(36)   NOT NULL,
  name       VARCHAR(255)  NOT NULL,
  amount     DECIMAL(10,2) NOT NULL,
  frequency  VARCHAR(20)   NOT NULL DEFAULT 'monthly',
  category   VARCHAR(50)   NULL,
  last_paid  DATE          NULL,
  created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Migrations (run on existing DB):
-- ALTER TABLE projects ADD COLUMN client_slug VARCHAR(100) UNIQUE NULL;
-- Run full CREATE TABLE quotes above on existing DB.
-- ALTER TABLE projects ADD COLUMN client_id VARCHAR(36) NULL;
-- ALTER TABLE projects ADD COLUMN deliveries JSON DEFAULT NULL;
-- ALTER TABLE quotes ADD COLUMN doc_type ENUM('quote','invoice') NOT NULL DEFAULT 'quote' AFTER lang;
-- ALTER TABLE quotes ADD COLUMN invoice_status ENUM('draft','to-validate','validated','paid','on-hold') NOT NULL DEFAULT 'draft' AFTER doc_type;
-- CREATE TABLE todos (...) as above (run full CREATE TABLE todos statement on existing DB);
-- CREATE TABLE notifications (...) as above (run full CREATE TABLE notifications statement on existing DB);
-- CREATE TABLE personal_todos (...) as above (run full CREATE TABLE personal_todos statement on existing DB);
-- CREATE TABLE personal_costs (...) as above (run full CREATE TABLE personal_costs statement on existing DB);
-- ============================================================
-- End of schema
-- ============================================================

-- ── Admin Doc Folders ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_doc_folders (
  id         VARCHAR(36)  NOT NULL,
  name       VARCHAR(255) NOT NULL,
  parent_id   VARCHAR(36)  NULL,
  sort_order   INT          NOT NULL DEFAULT 0,
  share_token  VARCHAR(64)  NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (parent_id) REFERENCES admin_doc_folders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Admin Docs ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_docs (
  id            VARCHAR(36)   NOT NULL,
  title         VARCHAR(255)  NOT NULL,
  category      VARCHAR(100)  NOT NULL DEFAULT 'Général',
  folder_id     VARCHAR(36)   NULL,
  year          SMALLINT      NULL,
  share_token   VARCHAR(64)   NULL,
  sort_order    INT           NOT NULL DEFAULT 0,
  filename      VARCHAR(255)  NOT NULL,
  original_name VARCHAR(255)  NOT NULL,
  file_size     INT           NOT NULL DEFAULT 0,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE INDEX idx_share_token (share_token),
  FOREIGN KEY (folder_id) REFERENCES admin_doc_folders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Admin Todos ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_todos (
  id          VARCHAR(36)   NOT NULL,
  text        TEXT          NOT NULL,
  completed   TINYINT(1)    NOT NULL DEFAULT 0,
  category    VARCHAR(100)  NOT NULL DEFAULT 'Général',
  due_date    DATE          NULL,
  sort_order  INT           NOT NULL DEFAULT 0,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_completed (completed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Migrations for new columns ──────────────────────────────────────────────
-- ALTER TABLE personal_todos ADD COLUMN due_date DATE NULL;
-- ALTER TABLE personal_todos ADD COLUMN recurring ENUM('daily','weekly','monthly') NULL;
-- CREATE TABLE consumables (
--   id CHAR(36) PRIMARY KEY,
--   name VARCHAR(255) NOT NULL,
--   estimated_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
--   every_n SMALLINT NOT NULL DEFAULT 1,
--   unit ENUM('days','weeks','months') NOT NULL DEFAULT 'weeks',
--   last_purchased DATE NULL,
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );
-- CREATE TABLE admin_docs (...) as above;
-- CREATE TABLE admin_todos (...) as above;

-- ── SMART Objectives (subtasks) ──────────────────────────────
-- ALTER TABLE personal_todos ADD COLUMN is_objective TINYINT(1) NOT NULL DEFAULT 0;
-- ALTER TABLE personal_todos ADD COLUMN description TEXT DEFAULT NULL;
-- ALTER TABLE admin_todos ADD COLUMN is_objective TINYINT(1) NOT NULL DEFAULT 0;
-- ALTER TABLE admin_todos ADD COLUMN description TEXT DEFAULT NULL;

CREATE TABLE IF NOT EXISTS todo_subtasks (
  id          VARCHAR(36)  NOT NULL,
  source      ENUM('personal','admin') NOT NULL,
  parent_id   VARCHAR(36)  NOT NULL,
  text        VARCHAR(500) NOT NULL,
  completed   TINYINT(1)   NOT NULL DEFAULT 0,
  due_date    DATE         DEFAULT NULL,
  sort_order  INT          NOT NULL DEFAULT 0,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_parent (source, parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Expenses (business expenses, migrated from localStorage) ──
CREATE TABLE IF NOT EXISTS expenses (
  id          VARCHAR(36)   NOT NULL,
  date        DATE          NOT NULL,
  amount      DECIMAL(10,2) NOT NULL,
  description VARCHAR(500)  NOT NULL DEFAULT '',
  category    VARCHAR(50)   NOT NULL DEFAULT 'other',
  notes       TEXT          NULL,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_date (date),
  INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Push Subscriptions (Web Push / VAPID) ─────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         VARCHAR(36)  NOT NULL,
  endpoint   TEXT         NOT NULL,
  p256dh     VARCHAR(255) NOT NULL,
  auth       VARCHAR(255) NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE INDEX idx_endpoint (endpoint(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Payment Plans (Trésorerie) ────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_plans (
  id             VARCHAR(36)   NOT NULL,
  name           VARCHAR(255)  NOT NULL,
  type           VARCHAR(30)   NOT NULL DEFAULT 'installment',
  monthly_amount DECIMAL(10,2) NOT NULL,
  total_months   INT           NOT NULL DEFAULT 12,
  start_date     DATE          NOT NULL,
  total_owed     DECIMAL(10,2) NULL,
  adjustment     DECIMAL(10,2) NULL,
  category       VARCHAR(50)   NULL,
  notes          TEXT          NULL,
  paid_months    JSON          NOT NULL DEFAULT '[]',
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Admin Deadlines (Échéances) ────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_deadlines (
  id              VARCHAR(36)   NOT NULL,
  title           VARCHAR(255)  NOT NULL,
  description     TEXT          NULL,
  due_date        DATE          NOT NULL,
  category        VARCHAR(50)   NOT NULL DEFAULT 'Général',
  recurring       VARCHAR(20)   NULL,
  remind_days     INT           NOT NULL DEFAULT 7,
  completed       TINYINT(1)    NOT NULL DEFAULT 0,
  completed_at    DATETIME      NULL,
  notified        TINYINT(1)    NOT NULL DEFAULT 0,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Migrations for notifications read tracking ────────────────
-- ALTER TABLE notifications ADD COLUMN `read` TINYINT(1) NOT NULL DEFAULT 0;
-- ALTER TABLE notifications ADD COLUMN read_at DATETIME NULL;
