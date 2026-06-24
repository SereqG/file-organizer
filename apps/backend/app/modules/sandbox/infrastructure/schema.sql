-- Sessions, saved workflows and run history for the sandboxed demo.
-- Timestamps are stored as epoch seconds (REAL) so TTL math is a simple subtraction.

CREATE TABLE IF NOT EXISTS sessions (
    id             TEXT PRIMARY KEY,
    created_at     REAL NOT NULL,
    last_active_at REAL NOT NULL,
    sandbox_path   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workflows (
    id              TEXT PRIMARY KEY,
    session_id      TEXT NOT NULL,
    name            TEXT NOT NULL,
    definition_json TEXT NOT NULL,
    created_at      REAL NOT NULL,
    updated_at      REAL NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS runs (
    id           TEXT PRIMARY KEY,
    session_id   TEXT NOT NULL,
    workflow_id  TEXT,
    status       TEXT NOT NULL,
    started_at   REAL,
    finished_at  REAL,
    summary_json TEXT,
    log_path     TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workflows_session ON workflows (session_id);
CREATE INDEX IF NOT EXISTS idx_runs_session ON runs (session_id);
