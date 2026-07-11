-- Career Companion Phase 0: make review_timing optional.
--
-- One-click email joins (signed-token links) register an email with no form,
-- so there's no review_timing to record. The column stays for the form-based
-- flow and so the question can be re-added later without another migration;
-- the CHECK still constrains any non-null value to the allowed set (a CHECK
-- passes on NULL in Postgres).

ALTER TABLE career_waitlist ALTER COLUMN review_timing DROP NOT NULL;
