-- The dashboard ended up computing all aggregations in the app layer (see
-- src/app/(app)/dashboard/page.tsx) - nothing ever queried these views, so drop them rather
-- than leave dead objects that would silently drift out of sync with future schema changes.
drop view if exists v_category_totals;
drop view if exists v_monthly_totals;
