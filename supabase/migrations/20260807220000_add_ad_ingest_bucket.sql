-- Migration: add_ad_ingest_bucket
-- ADR: docs/adr/0003-public-ad-ingest-bucket.md
--
-- Public Storage bucket used to stage ad creatives (images and videos) at a
-- URL the Meta Marketing API can fetch directly (link_data.picture, and
-- ads_creative_upload_video's video_url) — the Meta crawler cannot download
-- signed URLs from the private `creatives` bucket. Recreated here because it
-- previously existed out-of-band (per ADR 0003) but is missing from the
-- current project. file_size_limit raised to 300MB to cover ad video assets.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ad-ingest',
  'ad-ingest',
  true,
  314572800,
  array['image/png', 'image/jpeg', 'video/mp4', 'video/quicktime']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
