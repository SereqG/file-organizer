#!/usr/bin/env python3
"""Entry point for the data pipeline application."""

from utils import load_config, setup_logging
from pipeline import run_pipeline


def main():
    config = load_config("config.json")
    setup_logging(config.get("log_level", "INFO"))
    run_pipeline(config)


if __name__ == "__main__":
    main()
