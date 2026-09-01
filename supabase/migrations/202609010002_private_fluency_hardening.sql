-- Keep dashboard state readable and writable only by its authenticated owner.
-- RLS performs row ownership checks; grants below remove unrelated table powers
-- such as TRUNCATE, REFERENCES, and TRIGGER from browser-facing roles.
revoke all on table public.user_state from anon, authenticated;
grant select, insert, update on table public.user_state to authenticated;

-- Service-role access is used only by trusted server-side functions.
revoke all on table public.user_state from service_role;
grant select, insert, update, delete on table public.user_state to service_role;
