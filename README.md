# 🗂️ File Organizer

> A visual, node-based workflow builder for intelligent file organization — design drag-and-drop automations, preview them safely, and run them against an isolated sandbox with optional AI-powered classification.

<p>
  <img alt="Python" src="https://img.shields.io/badge/Python-3.13-3776AB?logo=python&logoColor=white">
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-0.128-009688?logo=fastapi&logoColor=white">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white">
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white">
  <img alt="Docker" src="https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white">
</p>

---

## 📖 Overview

**File Organizer** lets you build file-management workflows visually — like a flowchart — and execute
them against a safe, throwaway **sandbox** seeded with realistic sample files. Drag nodes onto a
canvas, connect them, configure each step, **preview** the exact result before anything touches disk,
then run it and watch live logs.

Because manipulating a visitor's real filesystem from a browser isn't possible (or safe), every
session gets its own isolated workspace on the server. This makes the project ideal as an
interactive demo while keeping a clean path toward future self-hosted, real-filesystem operation.

Highlights:

- 🧩 **Visual workflow editor** powered by React Flow — drag, drop, connect, configure.
- 🔍 **Dry-run preview** — simulate a workflow and inspect the predicted file tree before committing.
- ▶️ **Resumable execution engine** — live streamed logs, mid-run decision prompts, cancel & resume.
- 🤖 **AI Classifier node** — sort files into categories by reading their content (text, PDFs, images).
- 🔒 **Hardened sandbox** — path containment, symlink protection, quotas, runtime limits, auto-cleanup.
- 💾 **Persistence** — save/load workflows and browse run history (SQLite).

---

## ✨ Features & Node Catalog

Workflows are graphs of **nodes** connected from a trigger. Available nodes:

| Category | Nodes | What they do |
| --- | --- | --- |
| 🎯 **Triggers** | `Manual Trigger` | Entry point that starts a run on demand. |
| 🔀 **General** | `If`, `Switch` | Route items down different branches using rich conditions (text / number / date operators, `contains`, `between`, `within last N days`, …). |
| 📁 **Folders** | `Create Folder`, `Delete Folder`, `Rename Folder` | Folder lifecycle operations with conflict handling. |
| 📄 **Files** | `Delete File`, `Rename File` | File operations with rename-conflict resolution. |
| 🔁 **Transfer** | `Move File`, `Move Folder`, `Copy File`, `Copy Folder` | Relocate or duplicate items, with "if exists" strategies. |
| 🧠 **AI Nodes** | `AI Classifier` | Classify files/folders into user-defined categories using their content, then route each branch by category. Requires an OpenRouter API key. |

### 🤖 AI Classifier — how it works

- Batches items to the model and returns a **confidence score** per item/category pair.
- Reads **content** as the primary signal: plain text & code, extracted **PDF** text, and **images**
  (sent to a vision model). Falls back to name / extension / MIME type when content is unavailable.
- **Pre-filters** by item type and extension to avoid pointless model calls.
- **Caches** scores by content fingerprint, so re-simulating an unchanged workspace makes zero model calls.
- Honors per-category **confidence thresholds** and an "allow duplicate categories" option.
- The OpenRouter API key is supplied **per-user from the browser** and is never persisted server-side.

---

## 🛠️ Tech Stack

### Backend — `apps/backend`
- **Python 3.13**, **FastAPI** + **Uvicorn**
- **Pydantic v2** / **pydantic-settings** for models & configuration
- **OpenAI SDK** (pointed at **OpenRouter**, default model `google/gemini-2.5-flash`) for AI nodes
- **pypdf** (PDF text extraction) & **filetype** (magic-byte validation)
- **SQLite** for sessions, saved workflows and run history
- **uv** for dependency management; **pytest** for tests

### Frontend — `apps/frontend`
- **Next.js 16** (App Router, standalone output) + **React 19** + **TypeScript 5**
- **@xyflow/react** (React Flow) for the node editor
- **Tailwind CSS v4** + **react-icons**
- Same-origin **route handlers** proxy every call to the backend (no CORS surface)

### Infrastructure
- **Docker** + **docker-compose** for the full stack
- **Makefile** for common dev / Docker shortcuts

---

## 🏗️ Architecture

A monorepo with two apps. The browser only ever talks to the frontend, which proxies to the backend
over an internal network.

```text
Browser
   │  (same-origin /api/* route handlers)
   ▼
Frontend (Next.js)
   │  BACKEND_URL
   ▼
Backend API (FastAPI)
   ▼
Workflow Engine ──► Per-session Sandbox Directories
   ▼
SQLite (sessions · saved workflows · run history)
```

The backend follows **Vertical Slice Architecture** — each module is one self-contained business
capability with its own `api / application / domain / infrastructure` layers:

```text
file-organizer/
├── apps/
│   ├── backend/
│   │   ├── app/
│   │   │   ├── main.py            # FastAPI app + routers + cleanup loop
│   │   │   ├── config.py          # Settings (env-driven)
│   │   │   └── modules/
│   │   │       ├── ai/            # AI classifier, OpenRouter client, score cache
│   │   │       ├── files/         # File domain
│   │   │       ├── folder_explorer/  # Recursive traversal + depth confirmation
│   │   │       ├── sandbox/       # Sessions, containment, quotas, cleanup
│   │   │       ├── workflows/     # Execution engine, nodes, conditions, persistence
│   │   │       └── workspace_path/   # Path validation
│   │   ├── sandbox_template/      # Sample files seeded into each new sandbox
│   │   └── tests/                 # pytest suite
│   └── frontend/
│       ├── app/                   # Next.js routes + API proxy handlers
│       ├── components/            # UI + one folder per node type
│       ├── hooks/                 # Editor / execution / config hooks
│       └── lib/                   # Workflow registry, evaluator, types, validation
├── docs/                         # Specs, architecture notes & implementation plans
├── docker-compose.yml
└── makefile
```

---

## 🔒 Security & Sandboxing

Every session operates only inside its own sandbox directory. Enforced safeguards:

- 🛡️ **Path containment** — all paths are resolved and verified to stay within the sandbox root.
- 🔗 **Symlink protection** — escapes outside the sandbox are rejected.
- 📦 **Quotas** — `50 MB`, `1000 files`, `1000 folders` per session (configurable).
- ⏱️ **Runtime & size limits** — max `30s` active run time and max `100` nodes per workflow.
- 🚦 **One active run per session** — concurrent runs against the same sandbox are rejected.
- 🧹 **Auto-cleanup** — idle sandboxes (default TTL `1h`) are reclaimed on a background sweep.
- ✅ **Preview gating** — a run is rejected unless it matches a fresh dry-run preview token.

---

## 🚀 Getting Started (WSL)

These steps target **WSL2** (Ubuntu) but work on any Linux. Keep the project inside the Linux
filesystem (e.g. `~/projects/...`) rather than under `/mnt/c` for much better I/O performance.
With WSL2, `http://localhost:3000` is reachable directly from your Windows browser.

### ✅ Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| **Python** | 3.13+ | Backend runtime |
| **uv** | latest | Python dependency manager — `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| **Node.js** | 22+ | Frontend runtime (npm included) |
| **Docker** | optional | Only needed for the containerized stack |
| **OpenRouter API key** | optional | Only needed to use the AI Classifier node — entered in the browser, not in env |

### 1️⃣ Clone

```bash
git clone <repository-url> file-organizer
cd file-organizer
```

### 2️⃣ Backend

```bash
cd apps/backend
cp .env.example .env          # adjust if needed (defaults work out of the box)
uv sync --extra dev           # install runtime + dev dependencies
uv run python -m app.main     # starts on http://localhost:8000
```

> 💡 For auto-reload during development, set `DEBUG=true` in `.env`, or run
> `uv run uvicorn app.main:app --reload --port 8000`.
> Health check: <http://localhost:8000/workflows/api/health>

### 3️⃣ Frontend

In a second terminal:

```bash
cd apps/frontend
npm install
npm run dev                   # starts on http://localhost:3000
```

The frontend proxies API calls to `http://localhost:8000` by default (override with the
`BACKEND_URL` env var). Open **<http://localhost:3000>** and a sandbox session is created automatically.

### 4️⃣ (Optional) Enable the AI Classifier

Open **Run Settings** in the UI and paste your **OpenRouter API key**. It is stored client-side only
and sent with runs that use AI nodes — never written to the server.

---

## 🐳 Running with Docker

Builds both images and serves the app on **<http://localhost:3000>**. Only the frontend port is
published; the backend stays on the internal network.

```bash
docker compose up -d --build    # build & start
docker compose logs -f          # follow logs
docker compose down             # stop
```

Or via the Makefile shortcuts:

```bash
make build   # docker compose build
make up      # docker compose up -d
make logs    # docker compose logs -f
make down    # docker compose down
```

Runtime data persists in named volumes: `sandbox-data` (sandboxes + SQLite) and `run-logs`.

---

## ⚙️ Configuration

Backend settings are read from `apps/backend/.env` (see `.env.example`). All have sensible defaults.

| Variable | Default | Description |
| --- | --- | --- |
| `APP_NAME` | `File Organizer` | Application name. |
| `DEBUG` | `false` | Enables debug mode + Uvicorn auto-reload. |
| `HOST` / `PORT` | `0.0.0.0` / `8000` | Backend bind address. |
| `OPENROUTER_MODEL` | `google/gemini-2.5-flash` | Model used by AI nodes. |
| `SANDBOX_ROOT` | `apps/backend/var/sandboxes` | Per-session sandbox directories. |
| `SQLITE_PATH` | `apps/backend/var/app.db` | SQLite database file. |
| `SESSION_TTL_SECONDS` | `3600` | Idle time before a sandbox is reclaimed. |
| `QUOTA_MAX_BYTES` | `52428800` (50 MB) | Per-session storage ceiling. |
| `QUOTA_MAX_FILES` | `1000` | Per-session file ceiling. |
| `QUOTA_MAX_FOLDERS` | `1000` | Per-session folder ceiling. |
| `MAX_WORKFLOW_NODES` | `100` | Maximum nodes per workflow. |
| `MAX_RUNTIME_SECONDS` | `30` | Wall-clock cap on a single run's active execution. |
| `CLEANUP_INTERVAL_SECONDS` | `300` | How often expired sandboxes are swept. |

> 🔑 The **OpenRouter API key is intentionally not an environment variable** — it is supplied
> per-user from the browser so the hosted demo never holds anyone's key.

Frontend:

| Variable | Default | Description |
| --- | --- | --- |
| `BACKEND_URL` | `http://localhost:8000` | Base URL the Next route handlers proxy to. |

---

## 🧪 Testing & Linting

```bash
cd apps/backend
uv run pytest                 # backend test suite
uv run ruff check app tests   # lint (if ruff is installed)

cd ../frontend
npm run lint                  # ESLint
```

Or from the repo root: `make test` and `make lint`.

---

## 📚 Documentation

Architecture notes, node specifications and implementation plans live in [`docs/`](docs/):

- `file-workflow-app-summary.md` — overall architecture & security rationale
- `ai-classifier-node-specification.md`, `if-node-specification.md`, `create-folder-node-specification.md`
- `move-and-copy-nodes-implementation-plan.md`, `workflow-simulation-implementation-plan.md`
- `sandboxed-demo-implementation-plan.md`, `path_selection_security_summary.md`

Project-wide engineering conventions are documented in [`CLAUDE.md`](CLAUDE.md).

---

## 🗺️ Roadmap

The architecture is designed so the workflow engine stays independent of the underlying storage.
A planned `FileProvider` abstraction (`SandboxFileProvider`, `LocalHostFileProvider`, `S3FileProvider`, …)
opens the door to **self-hosted, real-filesystem** operation beyond the demo sandbox.
