"""Exercise the real hosted Senate export step without network access or delays."""
import os
from pathlib import Path
import subprocess

import pytest
import yaml


@pytest.mark.parametrize('succeeds_on,attempts,exit_code', [(1, 1, 0), (2, 2, 0), (4, 3, 1)])
def test_senate_export_retries_are_bounded_and_fail_closed(tmp_path, succeeds_on, attempts, exit_code):
    workflow = Path(__file__).resolve().parents[2] / '.github/workflows/senate-payload.yml'
    steps = yaml.safe_load(workflow.read_text())['jobs']['export']['steps']
    script = next(step['run'] for step in steps if step.get('name') == 'Fetch and parse every published session')
    script = script.replace('${{ runner.temp }}', str(tmp_path))
    fake_bin = tmp_path / 'bin'
    fake_bin.mkdir()
    python = fake_bin / 'python'
    python.write_text('''#!/usr/bin/env bash
count=0
if [[ -f "$CALLS" ]]; then count=$(cat "$CALLS"); fi
count=$((count + 1))
echo "$count" > "$CALLS"
[[ "$*" == *"src.senado.votaciones --export-directory"* ]] || exit 99
((count >= SUCCEEDS_ON))
''')
    sleep = fake_bin / 'sleep'
    sleep.write_text('#!/usr/bin/env bash\nexit 0\n')
    python.chmod(0o755)
    sleep.chmod(0o755)
    calls = tmp_path / 'calls'
    result = subprocess.run(['bash', '-e', '-c', script], capture_output=True, text=True,
        env={**os.environ, 'PATH': f"{fake_bin}:{os.environ['PATH']}",
             'CALLS': str(calls), 'SUCCEEDS_ON': str(succeeds_on)}, timeout=5)
    assert result.returncode == exit_code, result.stderr
    assert int(calls.read_text()) == attempts
