"""Denylist validator for an absolute host path.

Retained (unused by the active sandboxed flow) for a possible future self-host mode. The sandboxed
demo confines paths with an allowlist instead — see ``modules/sandbox/application/containment.py``.
"""

import os
import platform
from dataclasses import dataclass
from pathlib import Path, PurePosixPath, PureWindowsPath
from typing import Optional, Tuple

FORBIDDEN_PATHS_LINUX = frozenset([
    "/",
    "/bin",
    "/boot",
    "/dev",
    "/etc",
    "/lib",
    "/proc",
    "/sys",
    "/usr",
    "/var",
    "/System",
])

FORBIDDEN_PATHS_WINDOWS = frozenset([
    "C:\\",
    "C:\\Windows",
    "C:\\Program Files",
    "C:\\Program Files (x86)",
    "C:\\ProgramData",
    "C:\\Recovery",
    "C:\\System Volume Information",
])

HIGH_RISK_PATHS_LINUX = frozenset(["/home"])

HIGH_RISK_PATHS_WINDOWS = frozenset(["C:\\Users"])


@dataclass(frozen=True)
class PathValidationError:
    code: str
    message: str


def _is_absolute(path: str) -> bool:
    return PurePosixPath(path).is_absolute() or PureWindowsPath(path).is_absolute()


def _is_forbidden(canonical: Path, forbidden: frozenset[str]) -> bool:
    canonical_str = str(canonical)
    for forbidden_path in forbidden:
        if canonical_str == forbidden_path:
            return True
        if canonical_str.startswith(forbidden_path + os.sep):
            return True
    return False


def _is_high_risk(canonical: Path, high_risk: frozenset[str]) -> bool:
    return str(canonical) in high_risk


def validate_path(raw_path: str) -> Tuple[Optional[Path], Optional[PathValidationError]]:
    if not _is_absolute(raw_path):
        return None, PathValidationError(
            code="NOT_ABSOLUTE_PATH",
            message="Path must be an absolute path.",
        )

    normalized = Path(raw_path)

    try:
        canonical = normalized.resolve()
    except (OSError, ValueError):
        return None, PathValidationError(
            code="PATH_RESOLUTION_FAILED",
            message="Path could not be resolved to a canonical location.",
        )

    if not canonical.exists():
        return None, PathValidationError(
            code="PATH_NOT_FOUND",
            message="Path does not exist.",
        )

    if not canonical.is_dir():
        return None, PathValidationError(
            code="NOT_A_DIRECTORY",
            message="Path does not point to a directory.",
        )

    if platform.system() == "Windows":
        forbidden = FORBIDDEN_PATHS_WINDOWS
        high_risk = HIGH_RISK_PATHS_WINDOWS
    else:
        forbidden = FORBIDDEN_PATHS_LINUX
        high_risk = HIGH_RISK_PATHS_LINUX

    if _is_forbidden(canonical, forbidden):
        return None, PathValidationError(
            code="SYSTEM_DIRECTORY_BLOCKED",
            message="Selected path points to a protected system directory.",
        )

    if _is_high_risk(canonical, high_risk):
        return None, PathValidationError(
            code="HIGH_RISK_DIRECTORY_BLOCKED",
            message="Selected path points to a high-risk directory that is too broad for file organization.",
        )

    if not os.access(canonical, os.R_OK):
        return None, PathValidationError(
            code="PERMISSION_DENIED_READ",
            message="Read permission denied for the selected path.",
        )

    if not os.access(canonical, os.W_OK):
        return None, PathValidationError(
            code="PERMISSION_DENIED_WRITE",
            message="Write permission denied for the selected path.",
        )

    return canonical, None
