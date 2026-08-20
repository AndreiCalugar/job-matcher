-- Phase 6 adds the jobicy aggregator. The closed set on source.kind is a
-- CHECK constraint precisely so this is a drop + re-add in one migration.
alter table source drop constraint source_kind_check;
alter table source add constraint source_kind_check check (kind in (
  'manual','greenhouse','lever','ashby','workable','recruitee','personio',
  'adzuna','jsearch','arbeitnow','remoteok','jobicy'
));
