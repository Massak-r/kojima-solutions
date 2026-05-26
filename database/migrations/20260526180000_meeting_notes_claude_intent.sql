-- Marker that the operator wants Claude (via Claude Code + MCP) to process
-- this meeting note. The string holds a free-form intent ("extract todos",
-- "summarize for client recap", etc.) and is set to NULL once Claude
-- finishes the conversion and clears the flag.

ALTER TABLE meeting_notes ADD COLUMN claude_intent VARCHAR(255) DEFAULT NULL;

ALTER TABLE meeting_notes ADD COLUMN claude_requested_at DATETIME DEFAULT NULL;

CREATE INDEX idx_meeting_notes_claude ON meeting_notes (claude_requested_at);
