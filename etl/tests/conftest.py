"""Expose original pytest failures in the Actions summary and annotations."""

import html
import os
from pathlib import Path


_failures = []


def _record_failure(report):
    if not report.failed:
        return
    # Preserve the complete traceback in pytest's output. The summary needs
    # only the test identity, phase, and original exception message.
    crash = getattr(report.longrepr, "reprcrash", None)
    message = crash.message if crash else str(report.longrepr)
    _failures.append((report.nodeid, getattr(report, "when", "collection"), message))
    if os.getenv("GITHUB_ACTIONS") == "true":
        def escape(value):
            return str(value).replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
        print(f"::error::{escape(report.nodeid)}: {escape(message)}")


def pytest_runtest_logreport(report):
    _record_failure(report)


def pytest_collectreport(report):
    _record_failure(report)


def pytest_sessionfinish(session, exitstatus):
    summary = os.getenv("GITHUB_STEP_SUMMARY")
    if not summary:
        return
    lines = ["\n## ETL tests\n", f"Pytest exit code: {int(exitstatus)}.\n"]
    if _failures:
        for nodeid, phase, message in _failures:
            lines.append(
                f"<details><summary>{html.escape(nodeid)} ({html.escape(phase)})</summary>"
                f"\n\n<pre>{html.escape(message)}</pre>\n\n</details>\n"
            )
    elif exitstatus:
        lines.append("Pytest stopped before reporting a test failure; inspect the job log.\n")
    else:
        lines.append("All executed tests passed.\n")
    with Path(summary).open("a", encoding="utf-8") as output:
        output.write("\n".join(lines))
