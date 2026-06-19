# Backend image: FastAPI served by uvicorn, dependencies managed by uv.
FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    # Run from the project's virtualenv without `uv run` (which would try to build the project).
    PATH="/app/.venv/bin:$PATH"

# Install only third-party dependencies from the lockfile first, so this layer is cached unless the
# lockfile changes. The project itself is not installed — app.main is importable from the workdir.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Application code and the sandbox seed template (kept out of the dependency layer above).
COPY app ./app
COPY sandbox_template ./sandbox_template

EXPOSE 8000

# Runtime data (per-session sandboxes + SQLite) lives under /app/var, and execution logs under
# /app/logs — mount volumes there to persist them across restarts (see docker-compose.yml).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
