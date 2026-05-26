-- Pre-set target for Claude-MCP processing of a meeting note. When the
-- operator picks "Extract actions" or "Extract decisions", they also pick
-- the objective that should receive the resulting subtasks/decisions.
-- The skill reads this column instead of asking each time.

ALTER TABLE meeting_notes ADD COLUMN claude_target_objective_id VARCHAR(36) DEFAULT NULL;
