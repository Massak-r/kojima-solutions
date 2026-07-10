-- Plan du jour unifié : un time_block peut maintenant référencer un élément du
-- sprint (subtask ou tâche projet) pour lui donner une heure, avoir une fin
-- optionnelle (heure de début seule = "à 14:00"), et mémoriser l'heure réelle
-- de complétion (done_min) pour le feedback d'estimation.
-- time_blocks.php self-migre aussi ; ce fichier couvre les installs fraîches.
CREATE TABLE IF NOT EXISTS time_block (
    id          VARCHAR(36) PRIMARY KEY,
    day         DATE NOT NULL,
    start_min   SMALLINT UNSIGNED NOT NULL,
    end_min     SMALLINT UNSIGNED NULL,
    title       VARCHAR(255) NOT NULL DEFAULT '',
    color       VARCHAR(16) NULL,
    ref_kind    VARCHAR(16) NULL,
    ref_id      VARCHAR(64) NULL,
    done_min    SMALLINT UNSIGNED NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_day (day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
ALTER TABLE time_block MODIFY COLUMN end_min SMALLINT UNSIGNED NULL;
ALTER TABLE time_block ADD COLUMN IF NOT EXISTS ref_kind VARCHAR(16) NULL;
ALTER TABLE time_block ADD COLUMN IF NOT EXISTS ref_id VARCHAR(64) NULL;
ALTER TABLE time_block ADD COLUMN IF NOT EXISTS done_min SMALLINT UNSIGNED NULL;
