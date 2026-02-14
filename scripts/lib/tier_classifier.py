"""Tier classification, file walker, and node type derivation.

Walks a repository, classifies each file into Tier 1-4 based on
configurable glob rules in tier-rules.yaml, and derives a node type.
"""

import os
from dataclasses import dataclass
from fnmatch import fnmatch
from typing import Iterator

import yaml


@dataclass
class FileInfo:
    """Information about a classified repository file."""

    path: str  # Absolute path
    relative_path: str  # Path relative to repo root
    tier: int  # 1, 2, 3 (4 is excluded, never yielded)
    node_type: str  # story, epic, hook, skill, agent, adr, config, type_def, module, implementation


def load_tier_rules(rules_path: str) -> dict:
    """Load tier classification rules from a YAML file.

    Args:
        rules_path: Path to the tier-rules.yaml file.

    Returns:
        Dict with keys tier_1, tier_2, tier_3, tier_4.
    """
    with open(rules_path, "r") as f:
        return yaml.safe_load(f)


def classify_tier(relative_path: str, tier_rules: dict) -> int:
    """Classify a file into a tier based on its relative path.

    Evaluation order: Tier 4 (exclusion) -> Tier 1 -> Tier 2 -> Tier 3 (default).

    Args:
        relative_path: File path relative to repo root, using forward slashes.
        tier_rules: Loaded tier rules dict from load_tier_rules().

    Returns:
        Integer tier: 1, 2, 3, or 4.
    """
    # Normalize path separators to forward slashes
    rel = relative_path.replace(os.sep, "/")

    # --- Tier 4: Exclusion check ---
    tier_4 = tier_rules.get("tier_4", {})

    # Check excluded directories
    parts = rel.split("/")
    for directory in tier_4.get("directories", []):
        if directory in parts:
            return 4

    # Check excluded file extensions
    _, ext = os.path.splitext(rel)
    if ext in tier_4.get("extensions", []):
        return 4

    # Check excluded specific files
    filename = os.path.basename(rel)
    if filename in tier_4.get("files", []) or rel in tier_4.get("files", []):
        return 4

    # --- Tier 1: Definitional files ---
    for pattern in tier_rules.get("tier_1", []):
        if _match_glob(rel, pattern):
            return 1

    # --- Tier 2: Structural files ---
    for pattern in tier_rules.get("tier_2", []):
        if _match_glob(rel, pattern):
            return 2

    # --- Default: Tier 3 ---
    # tier_3 patterns in tier-rules.yaml exist as documentation only;
    # anything not matched by Tier 4/1/2 defaults to Tier 3.
    return 3


def derive_node_type(relative_path: str, tier: int) -> str:
    """Derive the node type for a file based on its path and tier.

    Args:
        relative_path: File path relative to repo root.
        tier: The tier classification (1, 2, or 3).

    Returns:
        One of: story, epic, hook, skill, agent, adr, config, type_def,
        module, implementation.
    """
    rel = relative_path.replace(os.sep, "/")

    # Path-based type derivation (order matters for specificity)
    if _match_glob(rel, "docs/stories/*"):
        return "story"
    if _match_glob(rel, "docs/epics/*"):
        return "epic"
    if _match_glob(rel, ".claude/hooks/*"):
        return "hook"
    if _match_glob(rel, ".claude/skills/**/*") or _match_glob(rel, ".claude/skills/*"):
        return "skill"
    if _match_glob(rel, ".claude/agents/*"):
        return "agent"
    if _match_glob(rel, "docs/adr/*"):
        return "adr"

    # Type definition files
    if rel.endswith(".d.ts"):
        return "type_def"

    # Module entry points
    basename = os.path.basename(rel)
    if basename in ("index.ts", "index.js"):
        return "module"

    # Config files
    if rel.endswith((".json", ".yaml", ".yml")) and tier <= 2:
        return "config"

    # Everything else
    return "implementation"


def walk_repository(
    root: str, tier_rules: dict
) -> Iterator[FileInfo]:
    """Walk a repository, classify files, and yield FileInfo for non-excluded files.

    Tier 4 directories are pruned in-place so os.walk() never descends into them.
    Tier 4 files are skipped entirely.

    Args:
        root: Absolute path to the repository root.
        tier_rules: Loaded tier rules dict.

    Yields:
        FileInfo for each non-excluded file.
    """
    tier_4 = tier_rules.get("tier_4", {})
    excluded_dirs = set(tier_4.get("directories", []))

    for dirpath, dirnames, filenames in os.walk(root):
        # Prune excluded directories in-place (prevents descent)
        dirnames[:] = [
            d for d in dirnames
            if d not in excluded_dirs
        ]

        for filename in filenames:
            abs_path = os.path.join(dirpath, filename)
            rel_path = os.path.relpath(abs_path, root)
            # Normalize to forward slashes
            rel_path = rel_path.replace(os.sep, "/")

            tier = classify_tier(rel_path, tier_rules)

            # Skip Tier 4 files
            if tier == 4:
                continue

            node_type = derive_node_type(rel_path, tier)

            yield FileInfo(
                path=abs_path,
                relative_path=rel_path,
                tier=tier,
                node_type=node_type,
            )


def _match_glob(path: str, pattern: str) -> bool:
    """Match a relative path against a glob pattern.

    Supports three pattern forms:
    - ``**/suffix``  — match suffix against any path component (e.g. ``**/README.md``)
    - ``prefix/**/suffix`` — match prefix at start, suffix at end, any depth between
    - Simple patterns — matched against full path AND basename, so ``jest.config.*``
      matches at any directory depth. This is intentional for tier-rules.yaml where
      config filenames should match regardless of nesting.

    Args:
        path: Relative file path (forward slashes).
        pattern: Glob pattern to match against.

    Returns:
        True if the path matches the pattern.
    """
    # --- Handle **/suffix patterns first (match at any depth) ---
    if pattern.startswith("**/"):
        suffix = pattern[3:]
        # Try matching suffix against each possible tail of the path
        # e.g. for path "a/b/c.md" try "a/b/c.md", "b/c.md", "c.md"
        segments = path.split("/")
        for i in range(len(segments)):
            tail = "/".join(segments[i:])
            if fnmatch(tail, suffix):
                return True
        return False

    # --- Handle prefix/**/suffix patterns ---
    if "**" in pattern:
        parts = pattern.split("**")
        if len(parts) == 2:
            prefix = parts[0].rstrip("/")
            suffix = parts[1].lstrip("/")

            # Prefix must match the start of the path
            if prefix and not path.startswith(prefix):
                return False

            if not suffix:
                # Pattern ends with ** — match anything under prefix
                return path.startswith(prefix) if prefix else True

            # Strip the prefix from the path and match suffix against the tail
            remaining = path[len(prefix):].lstrip("/") if prefix else path
            # Try matching suffix against each possible tail of remaining
            segments = remaining.split("/")
            for i in range(len(segments)):
                tail = "/".join(segments[i:])
                if fnmatch(tail, suffix):
                    return True
            return False

    # --- Simple patterns: match full path or basename ---
    # Basename fallback is intentional so patterns like "jest.config.*" match at any depth.
    return fnmatch(path, pattern) or fnmatch(os.path.basename(path), pattern)
