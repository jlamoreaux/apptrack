-- Backfill application_history for apps whose current status doesn't match
-- their most recent history entry. This fixes apps that were updated via the UI
-- before history tracking was added to the DAL.

INSERT INTO application_history (application_id, old_status, new_status, changed_at, notes)
SELECT 
  a.id,
  last_h.new_status AS old_status,
  a.status AS new_status,
  a.updated_at AS changed_at,
  'Backfill: status gap from missing history tracking' AS notes
FROM applications a
JOIN LATERAL (
  SELECT new_status
  FROM application_history
  WHERE application_id = a.id
  ORDER BY changed_at DESC
  LIMIT 1
) last_h ON true
WHERE a.status != last_h.new_status;
