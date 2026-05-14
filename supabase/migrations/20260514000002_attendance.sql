-- Attendance derived from votes table.
-- A politician "attended" a plenary session if they cast at least one non-"No vota" vote.

CREATE VIEW v_session_attendance AS
SELECT
    v.politician_id,
    vs.legislature_id,
    vs.session_number,
    MIN(vs.date) AS session_date,
    BOOL_OR(v.vote != 'No vota') AS was_present,
    COUNT(*) FILTER (WHERE v.vote != 'No vota') AS votes_cast,
    COUNT(DISTINCT vs.votacion_number) AS total_votaciones
FROM votes v
JOIN voting_sessions vs ON v.voting_session_id = vs.id
GROUP BY v.politician_id, vs.legislature_id, vs.session_number;

GRANT SELECT ON v_session_attendance TO anon, authenticated;

CREATE VIEW v_attendance_summary AS
SELECT
    politician_id,
    legislature_id,
    COUNT(*) AS total_sessions,
    SUM(CASE WHEN was_present THEN 1 ELSE 0 END) AS sessions_present,
    ROUND(
        SUM(CASE WHEN was_present THEN 1 ELSE 0 END)::numeric /
        NULLIF(COUNT(*), 0) * 100,
        1
    ) AS attendance_pct
FROM v_session_attendance
GROUP BY politician_id, legislature_id;

GRANT SELECT ON v_attendance_summary TO anon, authenticated;
