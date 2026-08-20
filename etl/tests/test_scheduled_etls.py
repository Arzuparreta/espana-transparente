import os
import subprocess
from pathlib import Path

import pytest


def test_daily_batch_continues_after_a_pipeline_failure(tmp_path):
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    calls = tmp_path / "calls.txt"
    fake_python = fake_bin / "python"
    fake_python.write_text(
        "#!/usr/bin/env bash\n"
        'if [[ "$*" == "-m common.pipeline_monitor preflight"* ]]; then exit 0; fi\n'
        'if [[ "$*" == "-m common.pipeline_monitor cleanup"* ]]; then echo "0"; exit 0; fi\n'
        'if [[ "$*" == "-m common.pipeline_monitor start"* ]]; then echo "00000000-0000-0000-0000-000000000001"; exit 0; fi\n'
        'if [[ "$*" == "-m common.pipeline_monitor finish"* ]]; then exit 0; fi\n'
        'printf "%s\\n" "$*" >> "$ETL_TEST_CALLS"\n'
        '[[ "$*" == *"src.contratacion.contratos"* ]] && exit 7\n'
        "exit 0\n"
    )
    fake_python.chmod(0o755)

    repo_etl = Path(__file__).resolve().parents[1]
    env = os.environ.copy()
    env["PATH"] = f"{fake_bin}:{env['PATH']}"
    env["ETL_TEST_CALLS"] = str(calls)

    result = subprocess.run(
        ["bash", "scripts/run_scheduled_etls.sh", "daily"],
        cwd=repo_etl,
        env=env,
        capture_output=True,
        text=True,
        timeout=15,
    )

    invoked = calls.read_text().splitlines()
    assert result.returncode == 1
    assert len(invoked) == 11
    assert "src.contratacion.contratos" in invoked[3]
    assert "src.territorio.atlas" in invoked[5]
    assert "src.territorio.org_geolocation" in invoked[6]
    assert "common.search_refresh" in invoked[-1]
    assert "contracts_daily (exit 7)" in result.stderr


def test_batch_stops_when_database_preflight_fails(tmp_path):
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    calls = tmp_path / "calls.txt"
    fake_python = fake_bin / "python"
    fake_python.write_text(
        "#!/usr/bin/env bash\n"
        'if [[ "$*" == "-m common.pipeline_monitor preflight"* ]]; then exit 1; fi\n'
        'printf "%s\\n" "$*" >> "$ETL_TEST_CALLS"\n'
        "exit 0\n"
    )
    fake_python.chmod(0o755)

    repo_etl = Path(__file__).resolve().parents[1]
    env = os.environ.copy()
    env["PATH"] = f"{fake_bin}:{env['PATH']}"
    env["ETL_TEST_CALLS"] = str(calls)

    result = subprocess.run(
        ["bash", "scripts/run_scheduled_etls.sh", "daily"],
        cwd=repo_etl,
        env=env,
        capture_output=True,
        text=True,
        timeout=15,
    )

    assert result.returncode == 75
    assert not calls.exists()
    assert "ETL batch stopped before opening more connections" in result.stdout


@pytest.mark.parametrize(
    ("batch", "expected_count", "required_module"),
    [
        ("weekly-core", 18, "src.congreso.declaraciones"),
        ("weekly-documents", 2, "src.borme.officers"),
        ("weekly-links", 10, "common.search_refresh"),
    ],
)
def test_weekly_batches_are_partitioned(
    tmp_path, batch, expected_count, required_module
):
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    calls = tmp_path / "calls.txt"
    fake_python = fake_bin / "python"
    fake_python.write_text(
        "#!/usr/bin/env bash\n"
        'if [[ "$*" == "-m common.pipeline_monitor preflight"* ]]; then exit 0; fi\n'
        'if [[ "$*" == "-m common.pipeline_monitor cleanup"* ]]; then echo "0"; exit 0; fi\n'
        'if [[ "$*" == "-m common.pipeline_monitor start"* ]]; then echo "00000000-0000-0000-0000-000000000001"; exit 0; fi\n'
        'if [[ "$*" == "-m common.pipeline_monitor finish"* ]]; then exit 0; fi\n'
        'printf "%s\\n" "$*" >> "$ETL_TEST_CALLS"\n'
        "exit 0\n"
    )
    fake_python.chmod(0o755)

    repo_etl = Path(__file__).resolve().parents[1]
    env = os.environ.copy()
    env["PATH"] = f"{fake_bin}:{env['PATH']}"
    env["ETL_TEST_CALLS"] = str(calls)

    result = subprocess.run(
        ["bash", "scripts/run_scheduled_etls.sh", batch],
        cwd=repo_etl,
        env=env,
        capture_output=True,
        text=True,
        timeout=15,
    )

    invoked = calls.read_text().splitlines()
    assert result.returncode == 0
    assert len(invoked) == expected_count
    assert any(required_module in call for call in invoked)


def _fake_python_bin(tmp_path):
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    fake_python = fake_bin / "python"
    fake_python.write_text(
        "#!/usr/bin/env bash\n"
        'if [[ "$*" == "-m common.pipeline_monitor preflight"* ]]; then exit 0; fi\n'
        'if [[ "$*" == "-m common.pipeline_monitor cleanup"* ]]; then echo "0"; exit 0; fi\n'
        'if [[ "$*" == "-m common.pipeline_monitor start"* ]]; then echo "00000000-0000-0000-0000-000000000001"; exit 0; fi\n'
        'if [[ "$*" == "-m common.pipeline_monitor finish"* ]]; then exit 0; fi\n'
        'printf "%s\\n" "$*" >> "$ETL_TEST_CALLS"\n'
        "exit 0\n"
    )
    fake_python.chmod(0o755)
    return fake_bin


def _run_weekly_core(tmp_path, extra_env):
    fake_bin = _fake_python_bin(tmp_path)
    calls = tmp_path / "calls.txt"
    env = os.environ.copy()
    env["PATH"] = f"{fake_bin}:{env['PATH']}"
    env["ETL_TEST_CALLS"] = str(calls)
    env.update(extra_env)

    subprocess.run(
        ["bash", "scripts/run_scheduled_etls.sh", "weekly-core"],
        cwd=Path(__file__).resolve().parents[1],
        env=env,
        capture_output=True,
        text=True,
        timeout=15,
    )
    return [c for c in calls.read_text().splitlines() if "kohesio" in c]


def test_weekly_core_ingests_the_prefetched_kohesio_payload(tmp_path):
    """The EC edge 403s the VPS runner, so a hosted job hands over the payload."""
    payload = tmp_path / "kohesio-beneficiaries.json"
    payload.write_text('{"list": [{"id": "x"}], "numberResults": 1}')

    kohesio_calls = _run_weekly_core(tmp_path, {"KOHESIO_PAYLOAD": str(payload)})
    assert len(kohesio_calls) == 1
    assert f"--from-file {payload}" in kohesio_calls[0]


def test_weekly_core_falls_back_to_a_direct_fetch_without_a_payload(tmp_path):
    """Manual runs from an unblocked host must still work with no artifact."""
    kohesio_calls = _run_weekly_core(tmp_path, {"KOHESIO_PAYLOAD": ""})
    assert len(kohesio_calls) == 1
    assert "--from-file" not in kohesio_calls[0]


def test_weekly_core_ignores_an_empty_payload_file(tmp_path):
    """A zero-byte artifact (failed upload) must not be passed off as data."""
    payload = tmp_path / "kohesio-beneficiaries.json"
    payload.write_text("")

    kohesio_calls = _run_weekly_core(tmp_path, {"KOHESIO_PAYLOAD": str(payload)})
    assert len(kohesio_calls) == 1
    assert "--from-file" not in kohesio_calls[0]
