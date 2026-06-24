BACKEND_DIR = apps/backend
FRONTEND_DIR = apps/frontend
VENV = .venv
PYTHON = $(VENV)/bin/python
UVICORN = $(VENV)/bin/uvicorn

.PHONY: dev dev-backend dev-frontend lint test build up down logs

dev: dev-backend dev-frontend

dev-backend:
	cd $(BACKEND_DIR) && $(PYTHON) -m app.main &

dev-frontend:
	cd $(FRONTEND_DIR) && npm run dev

test:
	cd $(BACKEND_DIR) && $(PYTHON) -m pytest

lint:
	cd $(BACKEND_DIR) && $(PYTHON) -m ruff check app tests

# --- Docker (public demo) ---
build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f
