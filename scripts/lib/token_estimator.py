"""Token estimation for repository files.

Uses a word-count heuristic (word_count * 1.3) to estimate token cost.
"""

import logging

logger = logging.getLogger(__name__)


def estimate_tokens(file_path: str) -> int:
    """Estimate the token count for a file using word count heuristic.

    Reads the file, splits on whitespace, and multiplies the word count
    by 1.3 (rounded to the nearest integer).

    Binary files or unreadable files return 0.

    Args:
        file_path: Path to the file.

    Returns:
        Estimated token count as an integer.
    """
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
    except (OSError, UnicodeDecodeError):
        # Binary or unreadable file
        return 0

    words = content.split()
    return round(len(words) * 1.3)
