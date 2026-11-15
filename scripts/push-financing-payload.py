#!/usr/bin/env python3
"""Fetch Hacienda on a reachable network and publish originals to the VPS.

Like the existing Kohesio transfer, this needs no database credentials.
"""
import argparse
import os
from pathlib import Path, PurePosixPath
import shlex
import subprocess
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'etl' / 'src'))
from presupuestos.financiacion import export_payload


PUBLISH = '''
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import time
stage = Path(sys.argv[1])
root = stage.parent
assert stage.name.startswith('snapshot.') and stage.is_dir()
manifest = json.loads((stage / 'manifest.json').read_text())
assert hashlib.sha256((stage / 'workbook.xlsx').read_bytes()).hexdigest() == manifest['sha256']
for name in ('manifest.json', 'workbook.xlsx'):
    (stage / name).chmod(0o644)
stage.chmod(0o755)
link = root / (stage.name + '.link')
link.symlink_to(stage.name, target_is_directory=True)
os.replace(link, root / 'current')
# Keep generations for three days; consumers reject payloads older than two.
for old in root.glob('snapshot.*'):
    if old != stage and not old.is_symlink() and old.is_dir() and old.stat().st_mtime < time.time() - 3 * 86400:
        shutil.rmtree(old)
'''


def push(host, remote_root):
    remote = PurePosixPath(remote_root)
    if not remote.is_absolute() or '..' in remote.parts:
        raise ValueError('Remote financing root must be an absolute path without traversal')

    def ssh(*args):
        return subprocess.run(['ssh', '-o', 'BatchMode=yes', host, shlex.join(args)],
            check=True, capture_output=True, text=True).stdout.strip()

    with tempfile.TemporaryDirectory(prefix='et-financing-') as directory:
        # Validate the whole official workbook before creating a remote stage.
        export_payload(directory)
        ssh('install', '-d', '-m', '755', str(remote))
        stage = ssh('mktemp', '-d', str(remote / 'snapshot.XXXXXXXX'))
        path = PurePosixPath(stage)
        if path.parent != remote or not path.name.startswith('snapshot.'):
            raise ValueError('Unexpected remote staging path')
        subprocess.run(['scp', '-q', '-o', 'BatchMode=yes',
            str(Path(directory) / 'manifest.json'), str(Path(directory) / 'workbook.xlsx'),
            f'{host}:{stage}/'], check=True)
        ssh('python3', '-c', PUBLISH, stage)
    print(f'Published verified financing originals to {host}:{remote}/current')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', default=os.getenv('ET_VPS', 'root@spaintransparencia.info'))
    parser.add_argument('--remote-root', default=os.getenv('ET_FINANCING_REMOTE',
        '/var/lib/espana-transparente/financing'))
    args = parser.parse_args()
    push(args.host, args.remote_root)
