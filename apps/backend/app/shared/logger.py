"""Shared logging utilities. Loggers write to logs/<name>.log relative to the backend root."""

import logging
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_LOG_DIR = _BACKEND_ROOT / "logs"


def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger

    logger.setLevel(logging.DEBUG)

    _LOG_DIR.mkdir(parents=True, exist_ok=True)
    handler = logging.FileHandler(_LOG_DIR / f"{name}.log", encoding="utf-8")
    handler.setFormatter(
        logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
    )
    logger.addHandler(handler)
    logger.propagate = False

    return logger
