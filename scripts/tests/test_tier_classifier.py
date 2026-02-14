"""Tests for tier classification, file walker, and node type derivation."""

import os
import tempfile

import pytest
import yaml

from scripts.lib.tier_classifier import (
    FileInfo,
    classify_tier,
    derive_node_type,
    load_tier_rules,
    walk_repository,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def tier_rules():
    """Load tier rules from the stub tier-rules.yaml."""
    rules_path = os.path.join(
        os.path.dirname(__file__), "..", "..", "docs", "_docgen", "tier-rules.yaml"
    )
    return load_tier_rules(rules_path)


@pytest.fixture
def temp_repo(tier_rules):
    """Create a temporary directory tree simulating a repository."""
    root = tempfile.mkdtemp()

    # Tier 4 exclusions -- should never be yielded
    _mkfile(root, "node_modules/some-pkg/index.js")
    _mkfile(root, ".git/config")
    _mkfile(root, "dist/bundle.js")
    _mkfile(root, "cdk.out/manifest.json")
    _mkfile(root, ".build/output.js")
    _mkfile(root, "package-lock.json")
    _mkfile(root, "yarn.lock")
    _mkfile(root, "assets/logo.png")
    _mkfile(root, "fonts/inter.woff")
    _mkfile(root, "temp.tmp")

    # Tier 1 files
    _mkfile(root, ".claude/skills/review/SKILL.md", "# Skill")
    _mkfile(root, ".claude/hooks/bash-guard.sh", "#!/bin/bash")
    _mkfile(root, ".claude/commands/deploy.md", "# Deploy")
    _mkfile(root, ".claude/agents/reviewer.md", "# Agent")
    _mkfile(root, "docs/adr/adr-001.md", "# ADR")
    _mkfile(root, "docs/epics/epic-1.md", "# Epic 1")
    _mkfile(root, "docs/stories/story-1-1.md", "# Story 1.1")
    _mkfile(root, "README.md", "# Project")
    _mkfile(root, "some/nested/CLAUDE.md", "# Claude")

    # Tier 2 files
    _mkfile(root, "package.json", '{"name": "test"}')
    _mkfile(root, "tsconfig.json", '{}')
    _mkfile(root, "jest.config.ts", "export default {}")
    _mkfile(root, ".eslintrc.js", "module.exports = {}")
    _mkfile(root, ".claude/settings.json", '{}')
    _mkfile(root, "shared/types/index.d.ts", "export interface Foo {}")
    _mkfile(root, "src/index.ts", "export {}")
    _mkfile(root, ".github/workflows/ci.yml", "name: CI")
    _mkfile(root, ".env.example", "API_KEY=xxx")

    # Tier 3 files
    _mkfile(root, "src/handler.ts", "export const handler = () => {}")
    _mkfile(root, "src/utils.js", "module.exports = {}")
    _mkfile(root, "frontend/App.tsx", "export default App")
    _mkfile(root, "frontend/Button.jsx", "export default Button")
    _mkfile(root, "src/handler.test.ts", "test('works', () => {})")
    _mkfile(root, "src/handler.spec.ts", "describe('handler', () => {})")
    _mkfile(root, "scripts/migrate.py", "# migration script")

    yield root

    # Cleanup
    import shutil
    shutil.rmtree(root)


def _mkfile(root: str, rel_path: str, content: str = "") -> str:
    """Create a file in the temp repo with optional content."""
    full_path = os.path.join(root, rel_path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w") as f:
        f.write(content)
    return full_path


# ===========================================================================
# Test: Tier 4 Exclusion (AC #1)
# ===========================================================================

class TestTier4Exclusion:
    """Tier 4 paths should never be yielded by the file walker."""

    def test_node_modules_excluded(self, temp_repo, tier_rules):
        paths = _walked_paths(temp_repo, tier_rules)
        assert not any("node_modules" in p for p in paths)

    def test_git_dir_excluded(self, temp_repo, tier_rules):
        paths = _walked_paths(temp_repo, tier_rules)
        assert not any(p.startswith(".git/") or p == ".git" for p in paths)

    def test_dist_excluded(self, temp_repo, tier_rules):
        paths = _walked_paths(temp_repo, tier_rules)
        assert not any(p.startswith("dist/") for p in paths)

    def test_cdk_out_excluded(self, temp_repo, tier_rules):
        paths = _walked_paths(temp_repo, tier_rules)
        assert not any(p.startswith("cdk.out/") for p in paths)

    def test_build_excluded(self, temp_repo, tier_rules):
        paths = _walked_paths(temp_repo, tier_rules)
        assert not any(p.startswith(".build/") for p in paths)

    def test_lockfiles_excluded(self, temp_repo, tier_rules):
        paths = _walked_paths(temp_repo, tier_rules)
        assert "package-lock.json" not in paths
        assert "yarn.lock" not in paths

    def test_binary_files_excluded(self, temp_repo, tier_rules):
        paths = _walked_paths(temp_repo, tier_rules)
        assert not any(p.endswith(".png") for p in paths)
        assert not any(p.endswith(".woff") for p in paths)

    def test_tmp_files_excluded(self, temp_repo, tier_rules):
        paths = _walked_paths(temp_repo, tier_rules)
        assert not any(p.endswith(".tmp") for p in paths)

    def test_classify_tier_returns_4_for_excluded(self, tier_rules):
        assert classify_tier("node_modules/pkg/index.js", tier_rules) == 4
        assert classify_tier(".git/config", tier_rules) == 4
        assert classify_tier("dist/bundle.js", tier_rules) == 4
        assert classify_tier("package-lock.json", tier_rules) == 4
        assert classify_tier("logo.png", tier_rules) == 4


# ===========================================================================
# Test: Tier 1 Classification (AC #2)
# ===========================================================================

class TestTier1Classification:
    """Tier 1 detection by path patterns."""

    def test_claude_skills(self, tier_rules):
        assert classify_tier(".claude/skills/review/SKILL.md", tier_rules) == 1

    def test_claude_hooks(self, tier_rules):
        assert classify_tier(".claude/hooks/bash-guard.sh", tier_rules) == 1

    def test_claude_commands(self, tier_rules):
        assert classify_tier(".claude/commands/deploy.md", tier_rules) == 1

    def test_claude_agents(self, tier_rules):
        assert classify_tier(".claude/agents/reviewer.md", tier_rules) == 1

    def test_docs_adr(self, tier_rules):
        assert classify_tier("docs/adr/adr-001.md", tier_rules) == 1

    def test_docs_epics(self, tier_rules):
        assert classify_tier("docs/epics/epic-1.md", tier_rules) == 1

    def test_docs_stories(self, tier_rules):
        assert classify_tier("docs/stories/story-1-1.md", tier_rules) == 1

    def test_readme(self, tier_rules):
        assert classify_tier("README.md", tier_rules) == 1

    def test_nested_readme(self, tier_rules):
        assert classify_tier("some/nested/README.md", tier_rules) == 1

    def test_skill_md(self, tier_rules):
        assert classify_tier("some/SKILL.md", tier_rules) == 1

    def test_claude_md(self, tier_rules):
        assert classify_tier("CLAUDE.md", tier_rules) == 1
        assert classify_tier("some/nested/CLAUDE.md", tier_rules) == 1

    def test_tier1_in_walker(self, temp_repo, tier_rules):
        infos = {fi.relative_path: fi for fi in walk_repository(temp_repo, tier_rules)}
        assert infos[".claude/skills/review/SKILL.md"].tier == 1
        assert infos["docs/adr/adr-001.md"].tier == 1
        assert infos["README.md"].tier == 1


# ===========================================================================
# Test: Tier 2 Classification (AC #3)
# ===========================================================================

class TestTier2Classification:
    """Tier 2 detection for structural/config files."""

    def test_package_json(self, tier_rules):
        assert classify_tier("package.json", tier_rules) == 2

    def test_tsconfig(self, tier_rules):
        assert classify_tier("tsconfig.json", tier_rules) == 2

    def test_jest_config(self, tier_rules):
        assert classify_tier("jest.config.ts", tier_rules) == 2

    def test_eslintrc(self, tier_rules):
        assert classify_tier(".eslintrc.js", tier_rules) == 2

    def test_claude_settings(self, tier_rules):
        assert classify_tier(".claude/settings.json", tier_rules) == 2

    def test_dts_files(self, tier_rules):
        assert classify_tier("shared/types/index.d.ts", tier_rules) == 2

    def test_index_ts(self, tier_rules):
        assert classify_tier("src/index.ts", tier_rules) == 2

    def test_index_js(self, tier_rules):
        assert classify_tier("lib/index.js", tier_rules) == 2

    def test_github_workflows(self, tier_rules):
        assert classify_tier(".github/workflows/ci.yml", tier_rules) == 2

    def test_env_example(self, tier_rules):
        assert classify_tier(".env.example", tier_rules) == 2


# ===========================================================================
# Test: Tier 3 Classification (AC #4)
# ===========================================================================

class TestTier3Classification:
    """Tier 3 as default for implementation files."""

    def test_ts_file(self, tier_rules):
        assert classify_tier("src/handler.ts", tier_rules) == 3

    def test_js_file(self, tier_rules):
        assert classify_tier("src/utils.js", tier_rules) == 3

    def test_tsx_file(self, tier_rules):
        assert classify_tier("frontend/App.tsx", tier_rules) == 3

    def test_jsx_file(self, tier_rules):
        assert classify_tier("frontend/Button.jsx", tier_rules) == 3

    def test_test_files(self, tier_rules):
        assert classify_tier("src/handler.test.ts", tier_rules) == 3
        assert classify_tier("src/handler.spec.ts", tier_rules) == 3

    def test_script_files(self, tier_rules):
        assert classify_tier("scripts/migrate.py", tier_rules) == 3


# ===========================================================================
# Test: Config-driven behavior (AC #5)
# ===========================================================================

class TestConfigDriven:
    """Changing config should change classification without code changes."""

    def test_adding_pattern_changes_tier(self, tier_rules):
        """If we add a custom pattern to tier 1, classification changes."""
        # A .ts file normally tier 3
        assert classify_tier("src/handler.ts", tier_rules) == 3

        # Now add a custom tier 1 rule for it
        modified_rules = _deep_copy_rules(tier_rules)
        modified_rules["tier_1"].append("src/handler.ts")
        assert classify_tier("src/handler.ts", modified_rules) == 1

    def test_removing_exclusion_includes_file(self, tier_rules):
        """If we remove node_modules from tier 4, it won't be excluded."""
        modified_rules = _deep_copy_rules(tier_rules)
        # Remove node_modules patterns from tier 4
        modified_rules["tier_4"]["directories"] = [
            d for d in modified_rules["tier_4"]["directories"]
            if "node_modules" not in d
        ]
        # Now node_modules files should classify as tier 3 (default)
        result = classify_tier("node_modules/pkg/index.js", modified_rules)
        assert result != 4


# ===========================================================================
# Test: Node Type Derivation (AC #6)
# ===========================================================================

class TestNodeTypeDerivation:
    """Each file gets a node type based on path and tier."""

    def test_story_type(self):
        assert derive_node_type("docs/stories/story-1-1.md", 1) == "story"

    def test_epic_type(self):
        assert derive_node_type("docs/epics/epic-1.md", 1) == "epic"

    def test_hook_type(self):
        assert derive_node_type(".claude/hooks/bash-guard.sh", 1) == "hook"

    def test_skill_type(self):
        assert derive_node_type(".claude/skills/review/SKILL.md", 1) == "skill"

    def test_agent_type(self):
        assert derive_node_type(".claude/agents/reviewer.md", 1) == "agent"

    def test_adr_type(self):
        assert derive_node_type("docs/adr/adr-001.md", 1) == "adr"

    def test_config_type_json(self):
        assert derive_node_type("package.json", 2) == "config"

    def test_config_type_yaml(self):
        assert derive_node_type("docs/_docgen/tier-rules.yaml", 2) == "config"

    def test_type_def(self):
        assert derive_node_type("shared/types/index.d.ts", 2) == "type_def"

    def test_module_type_index_ts(self):
        assert derive_node_type("src/index.ts", 2) == "module"

    def test_module_type_index_js(self):
        assert derive_node_type("lib/index.js", 2) == "module"

    def test_implementation_default(self):
        assert derive_node_type("src/handler.ts", 3) == "implementation"

    def test_implementation_test(self):
        assert derive_node_type("src/handler.test.ts", 3) == "implementation"


# ===========================================================================
# Test: File Walker Integration (AC #1-6 combined)
# ===========================================================================

class TestWalkerIntegration:
    """Integration tests using the temp directory tree."""

    def test_walker_yields_file_info(self, temp_repo, tier_rules):
        results = list(walk_repository(temp_repo, tier_rules))
        assert len(results) > 0
        assert all(isinstance(fi, FileInfo) for fi in results)

    def test_walker_file_info_has_required_fields(self, temp_repo, tier_rules):
        results = list(walk_repository(temp_repo, tier_rules))
        for fi in results:
            assert hasattr(fi, "path")
            assert hasattr(fi, "relative_path")
            assert hasattr(fi, "tier")
            assert hasattr(fi, "node_type")

    def test_walker_no_tier4_files(self, temp_repo, tier_rules):
        results = list(walk_repository(temp_repo, tier_rules))
        for fi in results:
            assert fi.tier != 4, f"Tier 4 file yielded: {fi.relative_path}"

    def test_walker_includes_all_tiers(self, temp_repo, tier_rules):
        results = list(walk_repository(temp_repo, tier_rules))
        tiers = {fi.tier for fi in results}
        assert 1 in tiers, "Should include Tier 1 files"
        assert 2 in tiers, "Should include Tier 2 files"
        assert 3 in tiers, "Should include Tier 3 files"

    def test_walker_relative_paths_are_relative(self, temp_repo, tier_rules):
        results = list(walk_repository(temp_repo, tier_rules))
        for fi in results:
            assert not fi.relative_path.startswith("/"), (
                f"Relative path should not start with /: {fi.relative_path}"
            )

    def test_walker_absolute_paths_exist(self, temp_repo, tier_rules):
        results = list(walk_repository(temp_repo, tier_rules))
        for fi in results:
            assert os.path.isfile(fi.path), f"File should exist: {fi.path}"


# ===========================================================================
# Test: load_tier_rules
# ===========================================================================

class TestLoadTierRules:
    """Test loading and validation of tier rules YAML."""

    def test_load_tier_rules_from_file(self, tier_rules):
        assert "tier_1" in tier_rules
        assert "tier_2" in tier_rules
        assert "tier_3" in tier_rules
        assert "tier_4" in tier_rules

    def test_tier_4_has_directories_and_extensions(self, tier_rules):
        assert "directories" in tier_rules["tier_4"]
        assert "extensions" in tier_rules["tier_4"]
        assert "files" in tier_rules["tier_4"]

    def test_tier_4_includes_node_modules(self, tier_rules):
        assert "node_modules" in tier_rules["tier_4"]["directories"]

    def test_tier_rules_has_lists(self, tier_rules):
        assert isinstance(tier_rules["tier_1"], list)
        assert isinstance(tier_rules["tier_2"], list)
        assert isinstance(tier_rules["tier_3"], list)


# ===========================================================================
# Helpers
# ===========================================================================

def _walked_paths(root: str, tier_rules: dict) -> set:
    """Return set of relative paths yielded by the walker."""
    return {fi.relative_path for fi in walk_repository(root, tier_rules)}


def _deep_copy_rules(rules: dict) -> dict:
    """Deep copy tier rules dict for modification in tests."""
    import copy
    return copy.deepcopy(rules)
