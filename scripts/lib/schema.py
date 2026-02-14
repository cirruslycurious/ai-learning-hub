"""SQLite schema creation for the documentation generation repository index."""

import sqlite3


def create_schema(db_path: str) -> sqlite3.Connection:
    """Create the repository index schema in a SQLite database.

    Creates tables: nodes, edges, glossary_canonical, glossary_variants,
    glossary_forbidden. Uses IF NOT EXISTS for idempotency.

    Args:
        db_path: Path to the SQLite database file, or ":memory:" for in-memory.

    Returns:
        An open sqlite3.Connection with foreign keys enabled and WAL mode set.
    """
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")

    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS nodes (
            id              TEXT PRIMARY KEY,
            tier            INTEGER NOT NULL,
            type            TEXT NOT NULL,
            name            TEXT,
            token_estimate  INTEGER,
            frontmatter     TEXT,             -- raw YAML stored as JSON string; no DB-level validation, use json.dumps() when inserting
            last_modified   TEXT
        );

        CREATE TABLE IF NOT EXISTS edges (
            source_id   TEXT NOT NULL,
            target_id   TEXT NOT NULL,
            edge_type   TEXT NOT NULL,
            UNIQUE (source_id, target_id, edge_type),
            FOREIGN KEY (source_id) REFERENCES nodes(id),
            FOREIGN KEY (target_id) REFERENCES nodes(id)
        );

        CREATE TABLE IF NOT EXISTS glossary_canonical (
            term        TEXT PRIMARY KEY,
            definition  TEXT NOT NULL,
            source_file TEXT NOT NULL,
            FOREIGN KEY (source_file) REFERENCES nodes(id)
        );

        CREATE TABLE IF NOT EXISTS glossary_variants (
            variant         TEXT PRIMARY KEY,
            canonical_term  TEXT NOT NULL,
            usage_rule      TEXT,
            FOREIGN KEY (canonical_term) REFERENCES glossary_canonical(term)
        );

        CREATE TABLE IF NOT EXISTS glossary_forbidden (
            forbidden_term  TEXT PRIMARY KEY,
            canonical_term  TEXT NOT NULL,
            FOREIGN KEY (canonical_term) REFERENCES glossary_canonical(term)
        );
        """
    )

    return conn
