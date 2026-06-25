"""Shared utility functions."""

import json
import logging
from pathlib import Path


def load_config(path: str) -> dict:
    with open(path) as f:
        return json.load(f)


def setup_logging(level: str = "INFO") -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper()),
        format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    )
