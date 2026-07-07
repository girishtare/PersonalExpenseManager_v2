-- Private bucket for uploaded bank statement files.
-- Path convention: {user_id}/{statement_id}/{file_name}

insert into storage.buckets (id, name, public)
values ('statements', 'statements', false)
on conflict (id) do nothing;

create policy statements_bucket_owner_select on storage.objects
  for select using (bucket_id = 'statements' and (storage.foldername(name))[1] = auth.uid()::text);

create policy statements_bucket_owner_insert on storage.objects
  for insert with check (bucket_id = 'statements' and (storage.foldername(name))[1] = auth.uid()::text);

create policy statements_bucket_owner_update on storage.objects
  for update using (bucket_id = 'statements' and (storage.foldername(name))[1] = auth.uid()::text);

create policy statements_bucket_owner_delete on storage.objects
  for delete using (bucket_id = 'statements' and (storage.foldername(name))[1] = auth.uid()::text);
