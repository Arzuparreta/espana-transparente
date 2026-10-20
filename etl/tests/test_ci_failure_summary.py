import os
from pathlib import Path
import subprocess
import sys

import pytest


@pytest.mark.parametrize("source, identity", [
    ('def test_schema():\n    raise RuntimeError(\'relation "bdns_call_misses" does not exist\')\n', "test_schema"),
    ('raise RuntimeError(\'relation "other_table" does not exist\')\n', "test_source.py"),
])
def test_ci_summary_preserves_original_failure(tmp_path, source, identity):
    plugin = Path(__file__).with_name("conftest.py").read_text()
    (tmp_path / "conftest.py").write_text(plugin)
    (tmp_path / "test_source.py").write_text(source)
    summary = tmp_path / "summary.md"
    env = dict(os.environ, GITHUB_ACTIONS="true", GITHUB_STEP_SUMMARY=str(summary))
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "-q", "--capture=no", "test_source.py"],
        cwd=tmp_path, env=env, capture_output=True, text=True, timeout=30,
    )
    assert result.returncode != 0
    assert "::error::" in result.stdout
    assert "does not exist" in result.stdout
    report = summary.read_text()
    assert identity in report
    assert "does not exist" in report
    assert "bdns_call_misses" in report or "other_table" in report
