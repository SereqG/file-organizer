"""Containment: resolve a client-supplied path against a session's sandbox and reject any escape.

This is an allowlist check — a path is accepted only when its real (symlink-resolved) location is
inside ``<sandbox_root>/<session_id>/``. It replaces the old denylist (``validate_path``) for the
active flow; the sandbox root is now the single confinement boundary.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Tuple

from app.modules.sandbox.application import session_service


@dataclass(frozen=True)
class ContainmentError:
    code: str
    message: str


def _resolve(root_real: Path, candidate: str) -> Path:
    """Real path of ``candidate``. Relative candidates are taken relative to the sandbox root;
    ``realpath`` collapses ``..`` and follows symlinks so traversal/symlink escapes surface here."""
    raw = Path(candidate)
    base = raw if raw.is_absolute() else (root_real / raw)
    return Path(os.path.realpath(base))


def confine(
    session_id: str,
    candidate_path: str,
    *,
    must_exist: bool = True,
    must_be_dir: bool = True,
) -> Tuple[Optional[Path], Optional[ContainmentError]]:
    """Resolve ``candidate_path`` inside the session's sandbox or return a containment error.

    ``must_exist``/``must_be_dir`` are relaxed for node config paths that an upstream node will only
    create during the run (e.g. a move target that does not exist yet at validation time).
    """
    root = session_service.get_sandbox_root(session_id)
    if root is None:
        return None, ContainmentError("SESSION_NOT_FOUND", "Session not found or expired.")

    root_real = Path(os.path.realpath(root))
    resolved = _resolve(root_real, candidate_path)

    if resolved != root_real and not resolved.is_relative_to(root_real):
        return None, ContainmentError("PATH_OUTSIDE_SANDBOX", "Path is outside the sandbox.")
    if must_exist and not resolved.exists():
        return None, ContainmentError("PATH_NOT_FOUND", "Path does not exist.")
    if must_be_dir and resolved.exists() and not resolved.is_dir():
        return None, ContainmentError("NOT_A_DIRECTORY", "Path is not a directory.")
    return resolved, None
