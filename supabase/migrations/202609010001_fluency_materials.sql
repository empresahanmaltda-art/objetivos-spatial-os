insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fluency-materials',
  'fluency-materials',
  false,
  12582912,
  array['application/pdf', 'text/plain', 'text/markdown', 'text/csv', 'text/tab-separated-values']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fluency_materials_select_own" on storage.objects;
create policy "fluency_materials_select_own"
on storage.objects for select to authenticated
using (bucket_id = 'fluency-materials' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "fluency_materials_insert_own" on storage.objects;
create policy "fluency_materials_insert_own"
on storage.objects for insert to authenticated
with check (bucket_id = 'fluency-materials' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "fluency_materials_update_own" on storage.objects;
create policy "fluency_materials_update_own"
on storage.objects for update to authenticated
using (bucket_id = 'fluency-materials' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'fluency-materials' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "fluency_materials_delete_own" on storage.objects;
create policy "fluency_materials_delete_own"
on storage.objects for delete to authenticated
using (bucket_id = 'fluency-materials' and (storage.foldername(name))[1] = (select auth.uid())::text);
