create table public.user_resources (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (length(kind) between 1 and 80),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);
alter table public.user_resources enable row level security;
revoke all on table public.user_resources from anon, authenticated;
grant select on table public.user_resources to authenticated;
create policy user_resources_read_own on public.user_resources
  for select to authenticated using ((select auth.uid()) = user_id);
comment on table public.user_resources is 'Owner-only imported resources, independent of mutable task snapshots. Client access is read-only.';
notify pgrst, 'reload schema';
