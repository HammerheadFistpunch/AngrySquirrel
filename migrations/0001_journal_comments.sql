-- Apply once to the COMMENTS_DB D1 database before enabling comments.
CREATE TABLE IF NOT EXISTS journal_comments (
    id TEXT PRIMARY KEY,
    article TEXT NOT NULL,
    name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 60),
    body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 3000),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    created_at INTEGER NOT NULL,
    moderated_at INTEGER,
    rate_key TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS comments_public ON journal_comments(article, status, created_at, id);
CREATE INDEX IF NOT EXISTS comments_moderation ON journal_comments(status, created_at, id);
CREATE INDEX IF NOT EXISTS comments_rate ON journal_comments(rate_key, created_at);
CREATE INDEX IF NOT EXISTS comments_created ON journal_comments(created_at);
