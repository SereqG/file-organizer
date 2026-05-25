BACKEND_DIR = apps/backend
FRONTEND_DIR = apps/frontend
VENV = $(BACKEND_DIR)/.venv
PYTHON = $(VENV)/bin/python
UVICORN = $(VENV)/bin/uvicorn

.PHONY: dev dev-backend dev-frontend lint test

dev: dev-backend dev-frontend

dev-backend:
	cd $(BACKEND_DIR) && $(UVICORN) app.main:app --reload --host 0.0.0.0 --port 8000 &

dev-frontend:
	cd $(FRONTEND_DIR) && npm run dev

test:
	cd $(BACKEND_DIR) && $(PYTHON) -m pytest

lint:
	cd $(BACKEND_DIR) && $(PYTHON) -m ruff check app tests
