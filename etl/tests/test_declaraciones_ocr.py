from congreso.declaraciones_ocr import (
    _resume_filter,
    _source_filter_for_kind,
    _with_ocr_failure,
    _with_ocr_success,
)


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
