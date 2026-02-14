"""Shared pytest fixtures for docgen tests."""

import pytest

from scripts.lib.schema import create_schema


@pytest.fixture
def db():
    """Create an in-memory database with the full schema applied."""
    conn = create_schema(":memory:")
    yield conn
    conn.close()
