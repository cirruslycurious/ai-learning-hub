"""Metadata extraction for repository files.

Extracts YAML frontmatter, JSON config metadata, human-readable names,
last-modified timestamps, and determines frontmatter-based tier upgrades.
"""

import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional

import yaml

logger = logging.getLogger(__name__)


def parse_frontmatter(file_path: str) -> Optional[dict]:
    """Extract YAML frontmatter from a markdown file.

    Frontmatter is delimited by ``---`` at the start of the file.
    The content between the first and second ``---`` lines is parsed
    as YAML.

    Args:
        file_path: Absolute or relative path to the file.

    Returns:
        Parsed frontmatter as a dict, or None if no frontmatter found
        or if parsing fails.
    """
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
    except (OSError, UnicodeDecodeError) as exc:
        logger.warning("Could not read %s: %s", file_path, exc)
        return None

    lines = content.split("\n")

    # First line must be '---'
    if not lines or lines[0].strip() != "---":
        return None

    # Find the closing '---'
    end_index = None
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            end_index = i
            break

    if end_index is None:
        return None

    frontmatter_text = "\n".join(lines[1:end_index])

    try:
        parsed = yaml.safe_load(frontmatter_text)
    except yaml.YAMLError as exc:
        logger.warning("Malformed YAML frontmatter in %s: %s", file_path, exc)
        return None

    # yaml.safe_load returns None for empty frontmatter, a scalar for
    # non-mapping content — we only want dicts.
    if not isinstance(parsed, dict):
        return None

    return parsed


def parse_json_config(file_path: str) -> Optional[dict]:
    """Extract metadata from a JSON config file.

    For ``package.json``, extracts: name, version, description.
    For ``settings.json`` / Claude settings, extracts: hooks configuration.
    For ``tsconfig.json``, extracts: compilerOptions.target, compilerOptions.module.
    For other JSON files, returns the full parsed content.

    Args:
        file_path: Path to the JSON file.

    Returns:
        Dict of extracted metadata fields, or None on parse failure.
    """
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        logger.warning("Could not parse JSON config %s: %s", file_path, exc)
        return None

    if not isinstance(data, dict):
        return None

    basename = os.path.basename(file_path)

    if basename == "package.json":
        return {
            k: data[k]
            for k in ("name", "version", "description")
            if k in data
        }

    if basename == "tsconfig.json":
        compiler_opts = data.get("compilerOptions", {})
        result = {}
        if "target" in compiler_opts:
            result["target"] = compiler_opts["target"]
        if "module" in compiler_opts:
            result["module"] = compiler_opts["module"]
        return result if result else None

    if basename == "settings.json":
        result = {}
        if "hooks" in data:
            result["hooks"] = data["hooks"]
        return result if result else None

    # Generic JSON: return all top-level keys
    return data


def extract_name(file_path: str, frontmatter: Optional[dict] = None) -> str:
    """Extract a human-readable name for a file.

    Priority: frontmatter ``title`` > frontmatter ``name`` > frontmatter
    ``id`` > filename-derived name.

    Args:
        file_path: Path to the file.
        frontmatter: Pre-parsed frontmatter dict, or None.

    Returns:
        Human-readable name string.
    """
    if frontmatter and isinstance(frontmatter, dict):
        for key in ("title", "name", "id"):
            value = frontmatter.get(key)
            if value is not None:
                return str(value)

    # Derive from filename: strip extension, replace hyphens/underscores with spaces
    basename = os.path.basename(file_path)
    name, _ = os.path.splitext(basename)
    return name.replace("-", " ").replace("_", " ")


def get_last_modified(file_path: str) -> str:
    """Get the filesystem last-modified time as an ISO 8601 timestamp.

    Args:
        file_path: Path to the file.

    Returns:
        ISO 8601 formatted UTC timestamp string.
    """
    mtime = os.path.getmtime(file_path)
    dt = datetime.fromtimestamp(mtime, tz=timezone.utc)
    return dt.isoformat()


def should_upgrade_tier(frontmatter: Optional[dict]) -> bool:
    """Determine if a file's tier should be upgraded to Tier 1 based on frontmatter.

    A file initially classified as Tier 2 or Tier 3 is upgraded to Tier 1
    if its frontmatter contains ``id``, ``title``, or ``role`` fields.

    Args:
        frontmatter: Parsed frontmatter dict, or None.

    Returns:
        True if the file qualifies for tier upgrade.
    """
    if not frontmatter or not isinstance(frontmatter, dict):
        return False

    upgrade_keys = {"id", "title", "role"}
    return bool(upgrade_keys & set(frontmatter.keys()))
