import pytest

from congreso.declaraciones_ocr import (
    _require_ocr_runtime,
    _resume_filter,
    _source_filter_for_kind,
    _with_ocr_failure,
    _with_ocr_success,
)


def test_ocr_runtime_fails_before_processing_without_poppler(monkeypatch):
    monkeypatch.setattr(
        "congreso.declaraciones_ocr.shutil.which",
        lambda binary: None if binary == "pdfinfo" else f"/usr/bin/{binary}",
    )

    with pytest.raises(RuntimeError, match="poppler-utils.*pdfinfo"):
        _require_ocr_runtime()


def test_source_filter_for_bienes_rentas_targets_docbienes():
    clause, params = _source_filter_for_kind("bienes_rentas")

    assert clause == "AND source_url LIKE %s"
    assert params == ["%docbienes%"]


def test_source_filter_for_intereses_targets_docacteco():
    clause, params = _source_filter_for_kind("intereses_economicos")

    assert clause == "AND source_url LIKE %s"
    assert params == ["%docacteco%"]


def test_source_filter_for_all_targets_both_declaration_pdf_families():
    clause, params = _source_filter_for_kind("all")

    assert clause == "AND (source_url LIKE %s OR source_url LIKE %s)"
    assert params == ["%docbienes%", "%docacteco%"]


def test_resume_filter_uses_processed_marker_and_skips_failures_by_default():
    clause = _resume_filter(retry_failed=False)

    assert "raw_data->>'ocr_processed_at' IS NULL" in clause
    assert "raw_data->>'ocr_preview'" not in clause
    assert "ocr_status" in clause
    assert "failed" in clause


def test_resume_filter_can_retry_failed_records():
    clause = _resume_filter(retry_failed=True)

    assert "raw_data->>'ocr_processed_at' IS NULL" in clause
    assert "failed" not in clause


def test_ocr_success_marks_ok_and_clears_previous_error():
    merged = _with_ocr_success(
        {"type": "bienes_rentas", "ocr_status": "failed", "ocr_error": "ocr_empty"},
        {"ocr_text": "texto", "total_income": 123.45},
    )

    assert merged["type"] == "bienes_rentas"
    assert merged["ocr_status"] == "ok"
    assert merged["ocr_text"] == "texto"
    assert merged["total_income"] == 123.45
    assert "ocr_error" not in merged
    assert "ocr_processed_at" in merged


def test_ocr_failure_preserves_existing_payload_and_records_attempt():
    merged = _with_ocr_failure({"type": "intereses_economicos"}, "download_failed")

    assert merged["type"] == "intereses_economicos"
    assert merged["ocr_status"] == "failed"
    assert merged["ocr_error"] == "download_failed"
    assert "ocr_attempted_at" in merged


def test_ocr_memory_envelope_is_bounded():
    """The OCR batch must stay inside the 11 GB runner.

    On 2026-08-20 four workers with unbounded torch thread pools peaked at
    ~7 GB RSS and tripped the global OOM killer, which took down the Actions
    runner mid-batch and truncated the whole daily ETL run.
    """
    from congreso import declaraciones_ocr as mod

    assert mod.PARALLEL_WORKERS <= 2
    assert mod.TORCH_THREADS_PER_WORKER == 1


def test_ocr_pins_thread_env_before_importing_torch():
    """OMP reads its pool size at import time; set_num_threads cannot shrink it."""
    import inspect

    source = inspect.getsource(
        __import__("congreso.declaraciones_ocr", fromlist=["run"]).run
    )
    omp_at = source.index('OMP_NUM_THREADS')
    torch_at = source.index('import torch')
    assert omp_at < torch_at, "OMP_NUM_THREADS must be set before torch is imported"
