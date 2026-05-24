-- get_entity_trail() accesses corruption_case_actors (RLS-restricted) and
-- other tables that anon cannot read directly.  Without SECURITY DEFINER the
-- judicial-cases branch (and several others) silently returns 0 rows for the
-- anon role even though the data exists.
--
-- get_party_cases() already used SECURITY DEFINER; this migration makes
-- get_entity_trail() consistent.

ALTER FUNCTION get_entity_trail(text, uuid) SECURITY DEFINER;
