-- Matching formula weights, editable from /admin/matching.
--
-- Stored as one JSON blob in system_settings so the ranking in
-- src/lib/personalized-matching.ts can be tuned without a deploy. Keys:
--   tagOverlap         points per shared interest tag (user ↔ event)
--   intentMatch        points when the event category matches a user intent
--   personaBoost       points when persona openness/energy aligns
--   momentum           multiplier on (attendees / capacity)
--   featured           flat bonus for Featured events
--   readinessThreshold 0–100; profiles below this see the editorial fallback feed

begin;

insert into system_settings (key, value)
values (
  'matching_weights',
  '{"tagOverlap":5,"intentMatch":4,"personaBoost":3,"momentum":2,"featured":2,"readinessThreshold":40}'::jsonb
)
on conflict (key) do nothing;

commit;
