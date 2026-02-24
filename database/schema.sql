-- ============================================================
-- Kojima Solutions — MariaDB Schema
-- Version: 1.0.0
-- Import with: mysql -u root -p kojima_solutions < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS kojima_solutions
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE kojima_solutions;

-- ── Projects ────────────────────────────────────────────────

CREATE TABLE projects (
  id              VARCHAR(36)   NOT NULL,
  title           VARCHAR(255)  NOT NULL,
  client          VARCHAR(255)  DEFAULT NULL,
  description     TEXT          DEFAULT NULL,
  status          ENUM('draft','in-progress','completed','on-hold') NOT NULL DEFAULT 'draft',
  start_date      DATE          DEFAULT NULL,
  end_date        DATE          DEFAULT NULL,
  initial_quote   VARCHAR(100)  DEFAULT NULL,
  revised_quote   VARCHAR(100)  DEFAULT NULL,
  invoice_number  VARCHAR(100)  DEFAULT NULL,
  payment_status  ENUM('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
  notes           TEXT          DEFAULT NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Tasks (Timeline Steps) ───────────────────────────────────

CREATE TABLE tasks (
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

CREATE TABLE subtasks (
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

CREATE TABLE feedback_requests (
  id            VARCHAR(36)   NOT NULL,
  task_id       VARCHAR(36)   NOT NULL,
  type          ENUM('feedback','file') NOT NULL,
  message       TEXT          NOT NULL,
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

CREATE TABLE task_feedbacks (
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

-- ── (Future) Users / Auth ────────────────────────────────────
-- Placeholder for when authentication is added behind Devis & Projets

CREATE TABLE users (
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

-- ============================================================
-- End of schema
-- ============================================================
