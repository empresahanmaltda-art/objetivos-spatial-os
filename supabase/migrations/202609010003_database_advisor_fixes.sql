-- Event-trigger helpers do not need to be callable through the Data API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated, service_role;

-- Cover the foreign key used by cascading user cleanup and delivery lookups.
create index if not exists push_deliveries_user_id_idx
  on public.push_deliveries (user_id);
