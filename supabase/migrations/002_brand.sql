-- Brand assets per event, uploaded to Blob by scripts/upload-brand.ts (the admin UI will replace it).
alter table events add column if not exists logo_url text;
alter table events add column if not exists icon_url text;
