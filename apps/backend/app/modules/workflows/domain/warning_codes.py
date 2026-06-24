"""Stable machine codes for :class:`ExecutionWarning`. Used by the Move/Copy transfer nodes to
report items they auto-skipped (or handled non-as-a-unit) without aborting the run. The frontend
groups warnings by these codes, so treat them as a stable contract."""

# A directory could not be moved/copied into its own descendant — skipped.
PARENT_INTO_DESCENDANT = "PARENT_INTO_DESCENDANT"
# The chosen target directory was itself one of the items being transferred — target skipped.
TARGET_IN_SCOPE = "TARGET_IN_SCOPE"
# The item already lives directly inside the target — nothing to do, skipped.
NO_OP_SAME_LOCATION = "NO_OP_SAME_LOCATION"
# Source and target are on different filesystems — unsupported for Move, skipped.
CROSS_FILESYSTEM = "CROSS_FILESYSTEM"
# A destination-name collision was resolved by skipping the item (ifExists == "skip").
COLLISION_SKIPPED = "COLLISION_SKIPPED"
# A partially-in-scope directory was not transferred as a unit; its in-scope children were
# handled individually (informational).
PARTIAL_DIRECTORY = "PARTIAL_DIRECTORY"
# A dry-run predicted the sandbox would exceed a per-session quota (files/folders/bytes). The same
# condition aborts a real run with this code instead of warning.
QUOTA_EXCEEDED = "QUOTA_EXCEEDED"
