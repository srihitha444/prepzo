-- Private storage for handwritten descriptive-answer submissions.
-- Run in Supabase SQL Editor before deploying the answer-upload UI.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ca-answer-images',
  'ca-answer-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "ca_answer_images_owner_insert" on storage.objects;
create policy "ca_answer_images_owner_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'ca-answer-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "ca_answer_images_owner_select" on storage.objects;
create policy "ca_answer_images_owner_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'ca-answer-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "ca_answer_images_owner_delete" on storage.objects;
create policy "ca_answer_images_owner_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'ca-answer-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "ca_answer_images_service_all" on storage.objects;
create policy "ca_answer_images_service_all"
  on storage.objects for all to service_role
  using (bucket_id = 'ca-answer-images')
  with check (bucket_id = 'ca-answer-images');

alter table question_attempts
  add column if not exists answer_images text[] not null default '{}';

create index if not exists idx_question_attempts_answer_images
  on question_attempts using gin (answer_images);
