begin;

-- 067_audit_logs_indexes.sql
--
-- audit_logs shipped with a primary key and nothing else, while being the
-- highest-volume table in the app: every admin action writes one row, and so
-- does every single click sent between members ('send_click'). It only ever
-- gets bigger, and it is never pruned.
--
-- Every read of it is a sequential scan today:
--
--   * getAdminAuditLog      - order by created_at desc limit 40, optionally
--                             filtered to action <> 'send_click' (the admin
--                             tab) or action = 'send_click' (the clicks tab).
--                             Postgres has to sort the whole table to return
--                             40 rows.
--   * getAdminSidebarCounts - a bounded recent-activity count, which runs on
--                             EVERY admin page render.
--
-- Three indexes, one per access path. All created concurrently-safe via
-- `if not exists` so a re-run is free.

-- The default ordering for both the list and the recent-activity count.
create index if not exists audit_logs_created_at_idx
  on audit_logs (created_at desc);

-- The two tabs on /admin/audit split the table on `action`, and each still
-- wants newest-first. A composite beats the plain created_at index for those
-- because the filter is applied in the index rather than after the sort.
create index if not exists audit_logs_action_created_at_idx
  on audit_logs (action, created_at desc);

-- The per-subject trail: "everything that has happened to this member /
-- merchant / event". Nothing reads this yet, but every write site already
-- populates both columns, and without the index the first screen that asks the
-- question scans the whole table.
create index if not exists audit_logs_entity_idx
  on audit_logs (entity_table, entity_id, created_at desc);

commit;
