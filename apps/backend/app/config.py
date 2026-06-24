from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# apps/backend — the runtime data dir (sandboxes + SQLite) lives under here and is gitignored.
_BACKEND_ROOT = Path(__file__).resolve().parents[1]
_VAR_DIR = _BACKEND_ROOT / "var"


class Settings(BaseSettings):
    # extra="ignore" so a leftover OPENROUTER_API_KEY in an existing .env (the key is now supplied
    # per-user from the browser) does not crash startup.
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "File Organizer"
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8000
    openrouter_model: str = "google/gemini-2.5-flash"

    # --- Sandboxed demo: isolation, persistence and safety limits ---
    # Root directory holding one throwaway sandbox per session (gitignored).
    sandbox_root: str = str(_VAR_DIR / "sandboxes")
    # SQLite database file for sessions, saved workflows and run history.
    sqlite_path: str = str(_VAR_DIR / "app.db")
    # A sandbox is reclaimed once it has been idle for this long.
    session_ttl_seconds: int = 3600
    # Per-session resource ceilings, enforced at dry-run (warn) and real run (abort).
    quota_max_bytes: int = 50 * 1024 * 1024
    quota_max_files: int = 1000
    quota_max_folders: int = 1000
    # A workflow may not exceed this many nodes.
    max_workflow_nodes: int = 100
    # Wall-clock cap on a single run's active execution time (excludes time awaiting a user
    # decision). Set above 10s because an AI Classifier node makes network calls per run.
    max_runtime_seconds: int = 30
    # How often the cleanup task sweeps expired sandboxes.
    cleanup_interval_seconds: int = 300
    # Global cap on live sandboxes; the oldest beyond this are reclaimed even if not yet expired.
    max_sessions: int = 500


settings = Settings()
