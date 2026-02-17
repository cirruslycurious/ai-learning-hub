"""Tests for scripts.lib.token_estimator."""

import os

import pytest

from scripts.lib.token_estimator import estimate_tokens


class TestEstimateTokens:
    """Tests for token estimation via word count heuristic (AC4)."""

    def test_known_word_count(self, tmp_path):
        """10 words * 1.3 = 13 tokens."""
        f = tmp_path / "ten_words.txt"
        f.write_text("one two three four five six seven eight nine ten")
        assert estimate_tokens(str(f)) == 13

    def test_single_word(self, tmp_path):
        """1 word * 1.3 = 1.3 -> rounds to 1."""
        f = tmp_path / "one.txt"
        f.write_text("hello")
        assert estimate_tokens(str(f)) == 1

    def test_empty_file(self, tmp_path):
        f = tmp_path / "empty.txt"
        f.write_text("")
        assert estimate_tokens(str(f)) == 0

    def test_whitespace_only(self, tmp_path):
        f = tmp_path / "spaces.txt"
        f.write_text("   \n\n\t  ")
        assert estimate_tokens(str(f)) == 0

    def test_multiline_content(self, tmp_path):
        """20 words across lines * 1.3 = 26."""
        f = tmp_path / "multi.txt"
        f.write_text("word " * 20)
        assert estimate_tokens(str(f)) == 26

    def test_rounding(self, tmp_path):
        """3 words * 1.3 = 3.9 -> rounds to 4."""
        f = tmp_path / "three.txt"
        f.write_text("alpha beta gamma")
        assert estimate_tokens(str(f)) == 4

    def test_rounding_down(self, tmp_path):
        """5 words * 1.3 = 6.5 -> rounds to 6 (banker's rounding)."""
        f = tmp_path / "five.txt"
        f.write_text("a b c d e")
        # Python round(6.5) = 6 (banker's rounding)
        assert estimate_tokens(str(f)) == 6

    def test_binary_file_returns_zero(self, tmp_path):
        f = tmp_path / "binary.bin"
        f.write_bytes(b"\x00\x01\x80\xff\xfe\x00\x00" * 100)
        assert estimate_tokens(str(f)) == 0

    def test_nonexistent_file_returns_zero(self):
        assert estimate_tokens("/no/such/file.txt") == 0

    def test_larger_document(self, tmp_path):
        """100 words * 1.3 = 130."""
        f = tmp_path / "hundred.txt"
        f.write_text(" ".join(f"word{i}" for i in range(100)))
        assert estimate_tokens(str(f)) == 130
