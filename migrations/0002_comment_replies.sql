-- Apply once, after 0001, BEFORE deploying reply support. Existing comments stay roots.
ALTER TABLE journal_comments ADD COLUMN parent_id TEXT REFERENCES journal_comments(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS comments_threads ON journal_comments(article, parent_id, status, created_at, id);
CREATE INDEX IF NOT EXISTS comments_parent ON journal_comments(parent_id);
