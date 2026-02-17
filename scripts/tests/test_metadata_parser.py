"""Tests for scripts.lib.metadata_parser."""

import json
import os

import pytest

from scripts.lib.metadata_parser import (
    extract_name,
    get_last_modified,
    parse_frontmatter,
    parse_json_config,
    should_upgrade_tier,
)


# ---------------------------------------------------------------------------
# parse_frontmatter
# ---------------------------------------------------------------------------


class TestParseFrontmatter:
    """Tests for YAML frontmatter extraction (AC1)."""

    def test_valid_frontmatter(self, tmp_path):
        f = tmp_path / "doc.md"
        f.write_text("---\ntitle: Hello World\ntags:\n  - python\n  - docs\n---\n# Content here\n")
        result = parse_frontmatter(str(f))
        assert result == {"title": "Hello World", "tags": ["python", "docs"]}

    def test_no_frontmatter(self, tmp_path):
        f = tmp_path / "plain.md"
        f.write_text("# Just a heading\nSome content\n")
        assert parse_frontmatter(str(f)) is None

    def test_malformed_yaml(self, tmp_path):
        f = tmp_path / "bad.md"
        f.write_text("---\ntitle: [unclosed bracket\n---\n")
        assert parse_frontmatter(str(f)) is None

    def test_empty_frontmatter(self, tmp_path):
        f = tmp_path / "empty.md"
        f.write_text("---\n---\nContent\n")
        assert parse_frontmatter(str(f)) is None

    def test_scalar_frontmatter_returns_none(self, tmp_path):
        """Frontmatter that parses to a scalar (not a dict) should return None."""
        f = tmp_path / "scalar.md"
        f.write_text("---\njust a string\n---\n")
        assert parse_frontmatter(str(f)) is None

    def test_frontmatter_with_dashes_in_body(self, tmp_path):
        """'---' appearing in content (not at line start) should not confuse parser."""
        f = tmp_path / "dashes.md"
        f.write_text("---\ntitle: Test\n---\nSome content with --- in the middle\n")
        result = parse_frontmatter(str(f))
        assert result == {"title": "Test"}

    def test_first_line_not_dashes(self, tmp_path):
        """File that has --- but not on the first line has no frontmatter."""
        f = tmp_path / "late.md"
        f.write_text("# Heading\n---\ntitle: Nope\n---\n")
        assert parse_frontmatter(str(f)) is None

    def test_unclosed_frontmatter(self, tmp_path):
        """Opening --- with no closing --- means no frontmatter."""
        f = tmp_path / "unclosed.md"
        f.write_text("---\ntitle: Oops\nNo closing delimiter\n")
        assert parse_frontmatter(str(f)) is None

    def test_nonexistent_file(self):
        assert parse_frontmatter("/no/such/file.md") is None

    def test_frontmatter_serializable_to_json(self, tmp_path):
        """Parsed frontmatter must be JSON-serializable for the DB column."""
        f = tmp_path / "serial.md"
        f.write_text("---\nid: abc-123\nrole: config\ncount: 42\n---\n")
        result = parse_frontmatter(str(f))
        serialized = json.dumps(result)
        assert json.loads(serialized) == result


# ---------------------------------------------------------------------------
# parse_json_config
# ---------------------------------------------------------------------------


class TestParseJsonConfig:
    """Tests for JSON config parsing (AC2)."""

    def test_package_json(self, tmp_path):
        f = tmp_path / "package.json"
        f.write_text(json.dumps({
            "name": "@ai-learning-hub/types",
            "version": "0.1.0",
            "description": "Shared types",
            "dependencies": {"zod": "^3.0.0"},
        }))
        result = parse_json_config(str(f))
        assert result == {
            "name": "@ai-learning-hub/types",
            "version": "0.1.0",
            "description": "Shared types",
        }

    def test_package_json_minimal(self, tmp_path):
        """package.json with only name — other fields omitted, not errored."""
        f = tmp_path / "package.json"
        f.write_text(json.dumps({"name": "foo"}))
        result = parse_json_config(str(f))
        assert result == {"name": "foo"}

    def test_tsconfig_json(self, tmp_path):
        f = tmp_path / "tsconfig.json"
        f.write_text(json.dumps({
            "compilerOptions": {"target": "ES2022", "module": "commonjs", "strict": True},
        }))
        result = parse_json_config(str(f))
        assert result == {"target": "ES2022", "module": "commonjs"}

    def test_tsconfig_no_compiler_options(self, tmp_path):
        f = tmp_path / "tsconfig.json"
        f.write_text(json.dumps({"extends": "../base.json"}))
        assert parse_json_config(str(f)) is None

    def test_settings_json_with_hooks(self, tmp_path):
        f = tmp_path / "settings.json"
        f.write_text(json.dumps({"hooks": {"pre-commit": "lint"}, "theme": "dark"}))
        result = parse_json_config(str(f))
        assert result == {"hooks": {"pre-commit": "lint"}}

    def test_settings_json_without_hooks(self, tmp_path):
        f = tmp_path / "settings.json"
        f.write_text(json.dumps({"theme": "dark"}))
        assert parse_json_config(str(f)) is None

    def test_generic_json(self, tmp_path):
        f = tmp_path / "config.json"
        data = {"key": "value", "nested": {"a": 1}}
        f.write_text(json.dumps(data))
        result = parse_json_config(str(f))
        assert result == data

    def test_malformed_json(self, tmp_path):
        f = tmp_path / "broken.json"
        f.write_text("{not valid json")
        assert parse_json_config(str(f)) is None

    def test_json_array_returns_none(self, tmp_path):
        """A JSON array at top-level is not a config dict."""
        f = tmp_path / "array.json"
        f.write_text("[1, 2, 3]")
        assert parse_json_config(str(f)) is None

    def test_nonexistent_json(self):
        assert parse_json_config("/no/such/file.json") is None


# ---------------------------------------------------------------------------
# extract_name
# ---------------------------------------------------------------------------


class TestExtractName:
    """Tests for human-readable name extraction (AC3)."""

    def test_title_from_frontmatter(self):
        fm = {"title": "My Great Doc", "name": "doc", "id": "abc"}
        assert extract_name("file.md", fm) == "My Great Doc"

    def test_name_from_frontmatter_when_no_title(self):
        fm = {"name": "doc-name", "id": "abc"}
        assert extract_name("file.md", fm) == "doc-name"

    def test_id_from_frontmatter_when_no_title_or_name(self):
        fm = {"id": "abc-123"}
        assert extract_name("file.md", fm) == "abc-123"

    def test_filename_derived_when_no_frontmatter(self):
        assert extract_name("some-cool-module.py", None) == "some cool module"

    def test_filename_derived_underscores(self):
        assert extract_name("my_helper_func.ts", None) == "my helper func"

    def test_filename_derived_mixed(self):
        assert extract_name("/path/to/edge-detector_v2.py", None) == "edge detector v2"

    def test_frontmatter_empty_dict(self):
        assert extract_name("readme.md", {}) == "readme"

    def test_frontmatter_with_none_values(self):
        """Keys present but set to None should fall through."""
        fm = {"title": None, "name": None, "id": "fallback-id"}
        assert extract_name("file.md", fm) == "fallback-id"

    def test_numeric_id_converted_to_string(self):
        fm = {"id": 42}
        assert extract_name("file.md", fm) == "42"


# ---------------------------------------------------------------------------
# get_last_modified
# ---------------------------------------------------------------------------


class TestGetLastModified:
    """Tests for last-modified timestamp extraction (AC5)."""

    def test_iso_format(self, tmp_path):
        f = tmp_path / "file.txt"
        f.write_text("content")
        result = get_last_modified(str(f))
        # Must be valid ISO 8601 with timezone
        assert "T" in result
        assert "+" in result or "Z" in result or result.endswith("+00:00")

    def test_timestamp_is_utc(self, tmp_path):
        f = tmp_path / "file.txt"
        f.write_text("content")
        result = get_last_modified(str(f))
        assert result.endswith("+00:00")

    def test_reflects_actual_mtime(self, tmp_path):
        f = tmp_path / "file.txt"
        f.write_text("hello")
        # Set a known mtime
        os.utime(str(f), (1700000000, 1700000000))
        result = get_last_modified(str(f))
        assert "2023-11-14" in result


# ---------------------------------------------------------------------------
# should_upgrade_tier
# ---------------------------------------------------------------------------


class TestShouldUpgradeTier:
    """Tests for frontmatter-based tier upgrade logic (AC6)."""

    def test_upgrade_with_id(self):
        assert should_upgrade_tier({"id": "abc"}) is True

    def test_upgrade_with_title(self):
        assert should_upgrade_tier({"title": "My Doc"}) is True

    def test_upgrade_with_role(self):
        assert should_upgrade_tier({"role": "config"}) is True

    def test_no_upgrade_without_qualifying_keys(self):
        assert should_upgrade_tier({"tags": ["a"], "status": "draft"}) is False

    def test_no_upgrade_with_none(self):
        assert should_upgrade_tier(None) is False

    def test_no_upgrade_with_empty_dict(self):
        assert should_upgrade_tier({}) is False

    def test_no_upgrade_with_non_dict(self):
        assert should_upgrade_tier("not a dict") is False

    def test_multiple_qualifying_keys(self):
        assert should_upgrade_tier({"id": "x", "title": "Y", "role": "z"}) is True
