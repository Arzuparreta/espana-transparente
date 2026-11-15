import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from unittest.mock import Mock

import pytest


SCRIPT = Path(__file__).resolve().parents[2] / 'scripts/push-financing-payload.py'
spec = importlib.util.spec_from_file_location('financing_transfer', SCRIPT)
transfer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(transfer)


def generation(root, name, content=b'original workbook'):
    directory = root / name
    directory.mkdir()
    (directory / 'workbook.xlsx').write_bytes(content)
    (directory / 'manifest.json').write_text(json.dumps(dict(sha256=hashlib.sha256(content).hexdigest())))
    return directory


def publish(directory):
    return subprocess.run([sys.executable, '-c', transfer.PUBLISH, str(directory)],
        capture_output=True, text=True, timeout=5)


def test_publish_switches_only_to_complete_generation_and_bounds_retention(tmp_path):
    old = generation(tmp_path, 'snapshot.old')
    recent = generation(tmp_path, 'snapshot.recent')
    ancient = generation(tmp_path, 'snapshot.ancient')
    (tmp_path / 'current').symlink_to(old.name, target_is_directory=True)
    os.utime(ancient, (time.time() - 4 * 86400,) * 2)
    new = generation(tmp_path, 'snapshot.new', b'new original')
    result = publish(new)
    assert result.returncode == 0, result.stderr
    assert (tmp_path / 'current').resolve() == new
    assert (new / 'workbook.xlsx').read_bytes() == b'new original'
    assert new.stat().st_mode & 0o777 == 0o755
    assert (new / 'manifest.json').stat().st_mode & 0o777 == 0o644
    assert old.exists() and recent.exists()
    assert not ancient.exists()
    assert not (tmp_path / 'snapshot.new.link').exists()


@pytest.mark.parametrize('change', ['missing', 'corrupt'])
def test_failed_transfer_keeps_the_previous_generation(tmp_path, change):
    old = generation(tmp_path, 'snapshot.old')
    (tmp_path / 'current').symlink_to(old.name, target_is_directory=True)
    partial = generation(tmp_path, 'snapshot.partial')
    if change == 'missing':
        (partial / 'workbook.xlsx').unlink()
    else:
        (partial / 'workbook.xlsx').write_bytes(b'corrupt')
    assert publish(partial).returncode != 0
    assert (tmp_path / 'current').resolve() == old


def test_invalid_source_never_starts_a_remote_transfer(monkeypatch):
    remote = Mock()
    monkeypatch.setattr(transfer, 'export_payload', Mock(side_effect=ValueError('reconciliation')))
    monkeypatch.setattr(transfer.subprocess, 'run', remote)
    with pytest.raises(ValueError, match='reconciliation'):
        transfer.push('test-host', '/var/lib/test-financing')
    remote.assert_not_called()
