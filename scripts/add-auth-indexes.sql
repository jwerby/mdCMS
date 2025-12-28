-- Add additional indexes for Better Auth database
-- Run with: sqlite3 content/auth.db < scripts/add-auth-indexes.sql

-- Index for session expiry queries (cleanup of expired sessions)
-- This helps when querying sessions that need to be cleaned up
CREATE INDEX IF NOT EXISTS "session_expiresAt_idx" ON "session" ("expiresAt");

-- Composite index for session validation (token + expiry check)
-- Speeds up session validation which is the most common operation
CREATE INDEX IF NOT EXISTS "session_token_expiresAt_idx" ON "session" ("token", "expiresAt");

-- Index for verification expiry (cleanup of expired verification tokens)
CREATE INDEX IF NOT EXISTS "verification_expiresAt_idx" ON "verification" ("expiresAt");

-- Analyze tables to update query planner statistics
ANALYZE;
