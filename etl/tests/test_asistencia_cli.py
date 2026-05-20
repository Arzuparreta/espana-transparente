from congreso.asistencia import build_arg_parser


def test_asistencia_accepts_resume_flag():
    args = build_arg_parser().parse_args(["--resume", "--from-date", "20250101"])

    assert args.resume is True
    assert args.from_date == 20250101
