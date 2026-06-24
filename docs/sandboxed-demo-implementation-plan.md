# Sandboxed Demo Architecture — Implementation Plan

## Context

`docs/file-workflow-app-summary.md` describes turning the app into a **publicly-hostable demo**: every visitor gets an isolated, throwaway workspace seeded with sample files, can build and run file-organization workflows safely, and nothing they do can touch the host.

Today the app is the opposite — a **self-hosted single-user tool**. The visitor types a *real absolute host path*, which is validated only against a blacklist (`validate_path`), and the workflow engine then reads/moves/deletes those real files. The engine itself is mature and stays unchanged in spirit (topological DAG execution — loops are structurally impossible; dry-run + preview tokens; resumable runs with collision decisions; undo/commit rollback; 9 file nodes + if/switch/ai_classifier).

**The decisions that shape this plan (confirmed with the user):**
1. **Sandbox simulates a real filesystem.** The folder-picker UX is kept, but jailed: the visitor selects a folder *inside their own sandbox*, not on the host. This is effectively sandbox-only (no real-host mode), which makes the sandbox root the single confinement boundary.
2. **Full persistence.** SQLite for sessions, saved workflows (save/load), and run history — new backend CRUD + new frontend UI.
3. **Deliver everything, including deployment** — but executed in the staged order below (CLAUDE.md mandates iterative delivery; this is large and multi-domain).

**The single most important current-state fact:** `POST /workflows/api/execute` (`apps/backend/app/modules/workflows/api/router.py:184-187`) accepts a raw `rootPath` string and calls `scan_directory(body.rootPath)` with **no session, no validation, no containment**. The existing `session_id` is decorative (in-memory dict, no TTL, never consulted by the engine). This is the central thing the plan fixes.

> ⚠️ This is a large epic spanning backend, frontend, persistence, and ops. Recommended to land it stage-by-stage (each stage is independently shippable and testable). Stages 1–2 are the security-critical core; do **not** deploy publicly before Stage 2 is complete.

---

## Target architecture

```
Browser ── Next.js route handlers (same-origin proxy) ── FastAPI backend
                                                              │
                                  ┌───────────────────────────┼───────────────────────────┐
                                  │                           │                           │
                            sandbox module               workflows engine             SQLite
                       (session + sandbox dir +         (unchanged logic, now      sessions / workflows / runs
                        seeding + containment +          fed a confined root)
                        quotas + cleanup)                       │
                                  └──────────── /sandboxes/<session_id>/ ────────────┘
                                                 (Downloads/ Documents/ Photos/ Invoices/ …)
```

- **Confinement boundary** = `<sandbox_root>/<session_id>/`. Every path the engine touches must resolve (via `realpath`) to a location strictly inside that directory.
- Client always works with paths *inside its sandbox*; the server **never trusts a client path** without re-resolving and asserting containment.
- No real-host mode, no `FileProvider` abstraction needed now (the summary's abstraction is deferred — noted under Future).

---

## Stage 0 — Foundations (config + SQLite + sandbox lifecycle)

**Goal:** a session provisions a seeded sandbox; persistence exists. No new deps (stdlib `sqlite3`; a `schema.sql` applied on startup — no Alembic).

- **Config** (`apps/backend/app/config.py`): add `sandbox_root` (dir, gitignored), `sqlite_path`, `session_ttl_seconds`, `quota_max_bytes` (≈50 MB), `quota_max_files` (≈1000), `quota_max_folders` (≈1000), `max_workflow_nodes` (≈100), `max_runtime_seconds` (≈10), `cleanup_interval_seconds`. Mirror in `apps/backend/.env.example`.
- **Seed template**: new `apps/backend/sandbox_template/` containing the sample tree (`Downloads/` with a few small files — a tiny `.pdf`, `.jpg`, `.txt`, `.csv`; empty `Documents/ Photos/ Invoices/`). Total a few KB so it never trips quotas. This is the source copied into each new sandbox.
- **New `sandbox` module** (vertical slice `apps/backend/app/modules/sandbox/{api,application,domain,infrastructure}`):
  - `infrastructure/db.py` — sqlite3 connection helper (WAL mode), applies `schema.sql` on first use.
  - `schema.sql` — `sessions(id, created_at, last_active_at, sandbox_path)`, `workflows(id, session_id, name, definition_json, created_at, updated_at)`, `runs(id, session_id, workflow_id, status, started_at, finished_at, summary_json, log_path)`.
  - `application/session_service.py` — `create_session()` → uuid, `copytree(sandbox_template → sandbox_root/<id>)`, insert row; `touch_session()` (updates `last_active_at`); `get_sandbox_root(session_id)`.
  - `api/router.py` — `POST /sandbox/api/session` (create/return session + initial tree), `GET /sandbox/api/session/{id}` (reattach).
- **Retire the in-memory `session_store`** (`workspace_path/application/session_store.py`) in favor of the DB-backed `session_service`. `workspace_path` becomes "resolve a chosen sub-path within the session's sandbox" (see Stage 1).

**Files:** new `modules/sandbox/**`, `sandbox_template/**`, edits to `config.py`, `.env.example`, `main.py` (register router + lifespan, see Stage 2).

---

## Stage 1 — Security core (containment) + in-sandbox folder selection

**Goal:** close the critical hole. Every entry point resolves a client path against the session's sandbox root and rejects anything outside; the engine is fed only confined paths. This is the heart of the whole feature.

- **New containment helper** `modules/sandbox/application/containment.py`:
  - `confine(session_id, candidate_path) -> (abs_path | error)`: load `sandbox_root` from DB; `os.path.realpath(candidate)`; assert `Path(real).is_relative_to(sandbox_root)`; assert exists + is_dir for roots. Replaces the blacklist approach of `validate_path` for the active flow (keep `validate_path` only if a self-host mode returns later).
  - This is an **allowlist/containment** check, not a denylist — the fix the summary marks CRITICAL.
- **Route folder selection through the sandbox:** `POST /workspace_path/api/get_path` (`workspace_path/api/router.py`) now takes `session_id` + a sandbox-relative (or absolute-inside-sandbox) path and calls `confine(...)` instead of `validate_path(...)`. The picker shows the sandbox tree and the user selects a folder within it.
- **Route exploration through containment:** `folder_explorer` already takes `session_id`; switch its path resolution to `confine(...)` (it currently re-validates via the old validator/fallback).
- **Route execution through the session — the key change** (`workflows/api/router.py:183-216`):
  - `ExecuteWorkflowRequest` gains `session_id` (required).
  - Before scanning: `root = confine(session_id, body.rootPath)`; 400 if outside.
  - Validate **every node config path** (`targetPath`, `parentFolderPath`, `folderPaths`, `filePaths`, …) with `confine(...)` before running — reject the run if any escapes.
  - `touch_session(session_id)` to keep it alive.
- **Defense-in-depth at write time** (`workflows/application/nodes/*.py` + `transfer_helpers.py`): add a single guard called by the mutating handlers (create/move/copy/rename/delete) that re-resolves the *real* target right before the syscall and asserts containment + **rejects symlinked targets** (`Path.is_symlink()`). This catches paths produced by config-remaps (Move rewrites downstream node paths) and any symlink that appeared after scan time. The scanner already skips symlinks on read; this covers the write side.

**Frontend (Stage 1 slice):**
- Replace the "enter an absolute host path" onboarding (`WorkspacePathForm`, `app/actions/workspace-path.ts`) with: on load, call `POST /api/sandbox/session` (new Next route) → get `session_id` + sandbox tree → render it → user picks a folder inside it as the workflow root. Thread `session_id` into the execute request body (`hooks/useWorkflowExecution.ts`, `app/api/workflows/execute/route.ts`).
- Persist `session_id` in a cookie (set by the new Next session route) so refresh reattaches to the same sandbox instead of losing it.

**Files:** new `modules/sandbox/application/containment.py`; edits to `workspace_path/api/router.py`, `folder_explorer/application/explore_service.py`, `workflows/api/router.py`, the mutating `workflows/application/nodes/*.py`; frontend `app/api/sandbox/**` (new), `components/WorkspacePathForm.tsx`/onboarding, `app/actions/workspace-path.ts`, `hooks/useWorkflowExecution.ts`, execute route handler.

---

## Stage 2 — Safety limits & ops (quotas, execution limits, run lock, cleanup)

**Goal:** make the demo safe to expose publicly. Addresses summary risks #3 (resource exhaustion), #4 (loops — already covered by DAG, plus runtime cap), #5 (concurrency), #6 (storage growth), #7 (upload — N/A, no upload).

- **Per-session quotas** (`modules/sandbox/application/quota.py`): compute sandbox size + file/folder counts (walk, or track incrementally). Enforce at two points: (a) **dry-run** — surface a warning in the preview if the planned tree would exceed limits (reuse the existing `finalTree`/`actions` the engine already produces); (b) **real run** — before each growth op (createFolder / copy fan-out) in the engine, abort with a clear `QUOTA_EXCEEDED` error if the next op would breach a limit. Copy fan-out is the main growth vector.
- **Execution limits** (`workflows/application/execute_workflow.py` + `execute_resumable.py`): reject workflows with `len(nodes) > max_workflow_nodes`; enforce a wall-clock `max_runtime_seconds` in the resumable worker (cancel like the existing cancel path). Recursion depth is N/A (DAG → bounded by node count).
- **Single active run per session** (`workflows/application/execution_store.py`): add `session_id` to `ExecutionState`; `start_execution` rejects (409 `RUN_IN_PROGRESS`) if the session already has a non-terminal run. Reuses the existing terminal-state machinery.
- **Scheduled cleanup** (`modules/sandbox/application/cleanup.py` + FastAPI **lifespan** in `main.py`): a dep-free `asyncio` periodic task that every `cleanup_interval_seconds` deletes sandboxes whose `last_active_at` is older than `session_ttl_seconds` (delete dir + DB rows + run logs), and enforces a global cap. Models on the existing `execution_store` TTL/GC pattern, but actually reclaims disk. Replaces the summary's "cron"; no new dependency.

**Files:** new `modules/sandbox/application/{quota.py,cleanup.py}`; edits to `execute_workflow.py`, `execute_resumable.py`, `execution_store.py`, `main.py`.

---

## Stage 3 — Full persistence (workflows save/load + run history)

**Goal:** workflows survive refresh; users see past runs. Uses the SQLite tables from Stage 0.

- **Backend CRUD** in the `sandbox` (or a dedicated `workflows` persistence) slice:
  - `POST /workflows/api/definitions` (save), `GET /workflows/api/definitions` (list for session), `GET/PUT/DELETE /.../definitions/{id}` — store the client `WorkflowDefinition` JSON keyed by `session_id`.
  - On run start/finish, write a `runs` row (status, summary, `log_path` — reuse the existing `logs/execution-*.log`). `GET /workflows/api/runs` lists history; `GET /workflows/api/runs/{id}` returns summary + serves the stored log.
- **Frontend:**
  - Save/load UI: a workflow list panel; "Save" serializes the in-memory `WorkflowDefinition` (today it lives only in React state — `hooks/useWorkflowDefinition.ts`) to the new endpoints; "Load" hydrates the canvas.
  - Run-history panel: list past runs for the session, open one to view its stored logs (reuse `LogsPanel`).
  - New Next route handlers under `app/api/workflows/definitions/**` and `app/api/workflows/runs/**` proxying to the backend.

**Files:** backend CRUD router + repository in `modules/sandbox/**` (or new `modules/workflows` persistence files); frontend new panels under `components/**`, hooks, and `app/api/workflows/**` routes.

---

## Stage 4 — Deployment

**Goal:** runnable as a public demo.

- **Backend Dockerfile**: `uv`-based, runs uvicorn; mounts a volume for `sandbox_root` + the SQLite file (so cleanup/quota persist across restarts).
- **Frontend Dockerfile**: Next 16 build/start. ⚠️ `apps/frontend/AGENTS.md` warns this Next version has breaking changes vs. training data — read `node_modules/next/dist/docs/` before scaffolding build config or new route handlers/cookies.
- **docker-compose.yml**: wires `BACKEND_URL`, `OPENROUTER_API_KEY`, sandbox + SQLite volumes; puts the backend on an internal network reachable only by the frontend (the browser already talks only to same-origin Next routes — so **no CORS opening needed**; instead lock the backend down). Add a healthcheck using the existing `/workflows/api/health`.
- `makefile`: add `make build` / `make up` targets.

**Files:** new `apps/backend/Dockerfile`, `apps/frontend/Dockerfile`, `docker-compose.yml`, `.dockerignore`s, `makefile` edits.

---

## Problems found & how each is solved

| # | Problem (current reality) | Fix |
|---|---|---|
| 1 | **CRITICAL: execute endpoint trusts raw `rootPath`** — no session, no validation, no containment (`workflows/api/router.py:186`). | Stage 1: require `session_id`, `confine()` the root + every node config path; write-time guard re-resolves real paths. |
| 2 | **Path traversal** (`../../etc`) — blacklist only, not applied at execution. | Stage 1: allowlist containment (`is_relative_to(sandbox_root)` on `realpath`) at every entry + write point. |
| 3 | **Symlink escape** — scanner skips symlinks on read, but write side is unguarded. | Stage 1: write-time guard rejects symlinked targets and re-checks containment after `realpath`. |
| 4 | **No isolation** — `session_id` decorative, no sandbox dirs, no sample files. | Stage 0: DB-backed sessions + per-session seeded sandbox dirs. |
| 5 | **No DB / nothing persists** (in-memory dicts, lost on restart). | Stage 0: stdlib `sqlite3` + `schema.sql`; Stage 3: workflows + runs persisted. |
| 6 | **Resource exhaustion** — copy fan-out / createFolder can grow disk unbounded; no quotas. | Stage 2: per-session quotas enforced at dry-run (warn) + real run (abort). |
| 7 | **Infinite loops** — already prevented (engine rejects cycles; DAG only). | Confirmed safe; Stage 2 adds a runtime cap + node-count cap as belt-and-suspenders. |
| 8 | **Concurrent runs** per session → races. | Stage 2: single-active-run lock in `execution_store` keyed by `session_id`. |
| 9 | **Storage growth** — no cleanup, no scheduler. | Stage 2: dep-free `asyncio` lifespan cleanup task (TTL by `last_active_at`). |
| 10 | **Frontend loses session on refresh** (React state only). | Stage 1: `session_id` cookie + reattach endpoint. |
| 11 | **No deployment story** (dev-only makefile). | Stage 4: Dockerfiles + compose + internal-network lockdown. |

---

## Key reuse (don't rebuild)

- Workflow engine, dry-run, preview tokens, resumable runs, undo/commit — **unchanged**; just fed a confined root and limit checks.
- `app/shared/traversal.py` symlink-skip + depth/file caps — reuse for scanning; mirror its caps into quotas.
- `execution_store` TTL/GC pattern — model for the cleanup task and the run lock.
- Existing `logs/execution-*.log` — reuse as the `runs.log_path` source for history.
- Frontend `FileTree`, `LogsPanel`, dry-run preview modal, decision modal — reused for sandbox tree, run history, and existing run UX.
- `validate_path` canonicalization/error-code style — informs `containment.py` (but pivots denylist → allowlist).

## Open/Deferred (not in this plan)
- `FileProvider` abstraction + real-host/S3/SMB providers (summary's "Recommended Abstraction") — deferred; sandbox-only for now.
- Auth/accounts — not required for an anonymous demo (sessions are anonymous handles).
- Queue/workers/Redis/Postgres — only at high traffic (summary §Scalability); SQLite + single process is correct for portfolio scale.

---

## Verification

**Per stage, end-to-end via the running app (`make dev`, then drive the UI):**
- **Stage 0:** hit `POST /sandbox/api/session` → confirm a seeded `<sandbox_root>/<id>/` appears with the sample tree; confirm a `sessions` row in SQLite.
- **Stage 1 (security — the important one):**
  - Happy path: select a folder inside the sandbox, build a Move/Copy workflow, dry-run, run → files move only within the sandbox.
  - Attack tests (add to `pytest`): execute with `rootPath` = `../../etc`, an absolute host path, and a node `targetPath` outside the sandbox → all rejected with containment errors; pre-create a symlink inside a sandbox pointing out → write-time guard rejects it. Confirm no file outside `<sandbox_root>` is ever touched.
- **Stage 2:** craft a copy-fan-out workflow that would exceed `quota_max_files` → dry-run warns, real run aborts `QUOTA_EXCEEDED`; start two runs for one session → second gets 409; set a tiny TTL → cleanup task removes the sandbox dir + rows.
- **Stage 3:** save a workflow, refresh, reload it onto the canvas; run it, then open run history and view the stored log.
- **Stage 4:** `make build && make up` → demo reachable; backend not directly reachable from the host network; sandbox + SQLite volumes survive a container restart.

**Automated:** extend backend `pytest` (`make test`) with containment/quota/limit/lock unit tests; `make lint` (ruff) clean.
