"""Tests for the SQLite schema creation module."""

import sqlite3

import pytest

from scripts.lib.schema import create_schema


# db fixture provided by conftest.py


class TestTableCreation:
    """Verify all 5 tables are created."""

    EXPECTED_TABLES = [
        "nodes",
        "edges",
        "glossary_canonical",
        "glossary_variants",
        "glossary_forbidden",
    ]

    def test_all_tables_exist(self, db):
        cursor = db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        tables = [row[0] for row in cursor.fetchall()]
        for table in self.EXPECTED_TABLES:
            assert table in tables, f"Table '{table}' not found in database"

    def test_exactly_five_tables(self, db):
        cursor = db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        tables = [row[0] for row in cursor.fetchall()]
        assert len(tables) == 5, f"Expected 5 tables, found {len(tables)}: {tables}"


class TestNodesTable:
    """Verify nodes table columns and types."""

    def test_nodes_columns(self, db):
        cursor = db.execute("PRAGMA table_info(nodes)")
        columns = {row[1]: row[2] for row in cursor.fetchall()}
        expected = {
            "id": "TEXT",
            "tier": "INTEGER",
            "type": "TEXT",
            "name": "TEXT",
            "token_estimate": "INTEGER",
            "frontmatter": "TEXT",
            "last_modified": "TEXT",
        }
        assert columns == expected

    def test_nodes_primary_key(self, db):
        cursor = db.execute("PRAGMA table_info(nodes)")
        for row in cursor.fetchall():
            if row[1] == "id":
                assert row[5] == 1, "nodes.id should be the primary key"

    def test_nodes_tier_not_null(self, db):
        with pytest.raises(sqlite3.IntegrityError):
            db.execute(
                "INSERT INTO nodes (id, type) VALUES ('test', 'implementation')"
            )

    def test_nodes_type_not_null(self, db):
        with pytest.raises(sqlite3.IntegrityError):
            db.execute("INSERT INTO nodes (id, tier) VALUES ('test', 1)")


class TestEdgesTable:
    """Verify edges table columns and foreign keys."""

    def test_edges_columns(self, db):
        cursor = db.execute("PRAGMA table_info(edges)")
        columns = {row[1]: row[2] for row in cursor.fetchall()}
        expected = {
            "source_id": "TEXT",
            "target_id": "TEXT",
            "edge_type": "TEXT",
        }
        assert columns == expected

    def test_edges_foreign_key_source(self, db):
        """Insert edge with nonexistent source_id should fail."""
        with pytest.raises(sqlite3.IntegrityError):
            db.execute(
                "INSERT INTO edges (source_id, target_id, edge_type) "
                "VALUES ('nonexistent', 'also_nonexistent', 'depends_on')"
            )

    def test_edges_foreign_key_target(self, db):
        """Insert edge with valid source but nonexistent target should fail."""
        db.execute(
            "INSERT INTO nodes (id, tier, type) VALUES ('real_node', 1, 'story')"
        )
        with pytest.raises(sqlite3.IntegrityError):
            db.execute(
                "INSERT INTO edges (source_id, target_id, edge_type) "
                "VALUES ('real_node', 'nonexistent', 'depends_on')"
            )

    def test_edges_valid_insert(self, db):
        """Valid edge between two existing nodes should succeed."""
        db.execute(
            "INSERT INTO nodes (id, tier, type) VALUES ('node_a', 1, 'story')"
        )
        db.execute(
            "INSERT INTO nodes (id, tier, type) VALUES ('node_b', 2, 'config')"
        )
        db.execute(
            "INSERT INTO edges (source_id, target_id, edge_type) "
            "VALUES ('node_a', 'node_b', 'references')"
        )
        cursor = db.execute("SELECT COUNT(*) FROM edges")
        assert cursor.fetchone()[0] == 1

    def test_edges_duplicate_rejected(self, db):
        """Inserting the same edge twice should fail (UNIQUE constraint)."""
        db.execute(
            "INSERT INTO nodes (id, tier, type) VALUES ('node_a', 1, 'story')"
        )
        db.execute(
            "INSERT INTO nodes (id, tier, type) VALUES ('node_b', 2, 'config')"
        )
        db.execute(
            "INSERT INTO edges (source_id, target_id, edge_type) "
            "VALUES ('node_a', 'node_b', 'references')"
        )
        with pytest.raises(sqlite3.IntegrityError):
            db.execute(
                "INSERT INTO edges (source_id, target_id, edge_type) "
                "VALUES ('node_a', 'node_b', 'references')"
            )

    def test_edges_different_type_allowed(self, db):
        """Same source/target with different edge_type should succeed."""
        db.execute(
            "INSERT INTO nodes (id, tier, type) VALUES ('node_a', 1, 'story')"
        )
        db.execute(
            "INSERT INTO nodes (id, tier, type) VALUES ('node_b', 2, 'config')"
        )
        db.execute(
            "INSERT INTO edges (source_id, target_id, edge_type) "
            "VALUES ('node_a', 'node_b', 'references')"
        )
        db.execute(
            "INSERT INTO edges (source_id, target_id, edge_type) "
            "VALUES ('node_a', 'node_b', 'depends_on')"
        )
        cursor = db.execute("SELECT COUNT(*) FROM edges")
        assert cursor.fetchone()[0] == 2


class TestGlossaryCanonicalTable:
    """Verify glossary_canonical table columns and foreign keys."""

    def test_glossary_canonical_columns(self, db):
        cursor = db.execute("PRAGMA table_info(glossary_canonical)")
        columns = {row[1]: row[2] for row in cursor.fetchall()}
        expected = {
            "term": "TEXT",
            "definition": "TEXT",
            "source_file": "TEXT",
        }
        assert columns == expected

    def test_glossary_canonical_primary_key(self, db):
        cursor = db.execute("PRAGMA table_info(glossary_canonical)")
        for row in cursor.fetchall():
            if row[1] == "term":
                assert row[5] == 1, "glossary_canonical.term should be the primary key"

    def test_glossary_canonical_foreign_key(self, db):
        """source_file must reference an existing node."""
        with pytest.raises(sqlite3.IntegrityError):
            db.execute(
                "INSERT INTO glossary_canonical (term, definition, source_file) "
                "VALUES ('test-term', 'A test definition', 'nonexistent_file')"
            )

    def test_glossary_canonical_valid_insert(self, db):
        db.execute(
            "INSERT INTO nodes (id, tier, type) VALUES ('docs/readme.md', 1, 'story')"
        )
        db.execute(
            "INSERT INTO glossary_canonical (term, definition, source_file) "
            "VALUES ('test-term', 'A test definition', 'docs/readme.md')"
        )
        cursor = db.execute("SELECT COUNT(*) FROM glossary_canonical")
        assert cursor.fetchone()[0] == 1


class TestGlossaryVariantsTable:
    """Verify glossary_variants table columns and foreign keys."""

    def test_glossary_variants_columns(self, db):
        cursor = db.execute("PRAGMA table_info(glossary_variants)")
        columns = {row[1]: row[2] for row in cursor.fetchall()}
        expected = {
            "variant": "TEXT",
            "canonical_term": "TEXT",
            "usage_rule": "TEXT",
        }
        assert columns == expected

    def test_glossary_variants_foreign_key(self, db):
        """canonical_term must reference an existing glossary_canonical term."""
        with pytest.raises(sqlite3.IntegrityError):
            db.execute(
                "INSERT INTO glossary_variants (variant, canonical_term) "
                "VALUES ('shorthand', 'nonexistent-term')"
            )

    def test_glossary_variants_valid_insert(self, db):
        db.execute(
            "INSERT INTO nodes (id, tier, type) VALUES ('src/file.md', 1, 'story')"
        )
        db.execute(
            "INSERT INTO glossary_canonical (term, definition, source_file) "
            "VALUES ('integration checkpoint', 'A validation step', 'src/file.md')"
        )
        db.execute(
            "INSERT INTO glossary_variants (variant, canonical_term, usage_rule) "
            "VALUES ('checkpoint', 'integration checkpoint', "
            "'after canonical form introduced')"
        )
        cursor = db.execute("SELECT COUNT(*) FROM glossary_variants")
        assert cursor.fetchone()[0] == 1


class TestGlossaryForbiddenTable:
    """Verify glossary_forbidden table columns and foreign keys."""

    def test_glossary_forbidden_columns(self, db):
        cursor = db.execute("PRAGMA table_info(glossary_forbidden)")
        columns = {row[1]: row[2] for row in cursor.fetchall()}
        expected = {
            "forbidden_term": "TEXT",
            "canonical_term": "TEXT",
        }
        assert columns == expected

    def test_glossary_forbidden_foreign_key(self, db):
        """canonical_term must reference an existing glossary_canonical term."""
        with pytest.raises(sqlite3.IntegrityError):
            db.execute(
                "INSERT INTO glossary_forbidden (forbidden_term, canonical_term) "
                "VALUES ('bad term', 'nonexistent-term')"
            )

    def test_glossary_forbidden_valid_insert(self, db):
        db.execute(
            "INSERT INTO nodes (id, tier, type) VALUES ('src/file.md', 1, 'story')"
        )
        db.execute(
            "INSERT INTO glossary_canonical (term, definition, source_file) "
            "VALUES ('integration checkpoint', 'A validation step', 'src/file.md')"
        )
        db.execute(
            "INSERT INTO glossary_forbidden (forbidden_term, canonical_term) "
            "VALUES ('integration validation', 'integration checkpoint')"
        )
        cursor = db.execute("SELECT COUNT(*) FROM glossary_forbidden")
        assert cursor.fetchone()[0] == 1


class TestSchemaIdempotency:
    """Running create_schema twice should not error."""

    def test_create_schema_twice_no_error(self):
        conn = create_schema(":memory:")
        # Call again on the same connection's database - simulated by calling again
        # Since :memory: creates a new db each time, test with a temp file
        import tempfile
        import os

        fd, path = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        try:
            conn1 = create_schema(path)
            conn1.close()
            conn2 = create_schema(path)
            # Verify tables still exist and work
            cursor = conn2.execute(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
            )
            tables = [row[0] for row in cursor.fetchall()]
            assert len(tables) == 5
            conn2.close()
        finally:
            os.unlink(path)
        conn.close()


class TestWALMode:
    """Verify WAL journal mode is enabled on file-based databases."""

    def test_wal_mode_enabled(self):
        """WAL mode only applies to file-based databases, not :memory:."""
        import tempfile
        import os

        fd, path = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        try:
            conn = create_schema(path)
            cursor = conn.execute("PRAGMA journal_mode")
            mode = cursor.fetchone()[0]
            assert mode == "wal", f"Expected WAL mode, got '{mode}'"
            conn.close()
        finally:
            for suffix in ("", "-wal", "-shm"):
                try:
                    os.unlink(path + suffix)
                except FileNotFoundError:
                    pass


class TestForeignKeysEnabled:
    """Verify foreign key enforcement is active."""

    def test_foreign_keys_on(self, db):
        cursor = db.execute("PRAGMA foreign_keys")
        result = cursor.fetchone()[0]
        assert result == 1, "Foreign keys should be enabled"
