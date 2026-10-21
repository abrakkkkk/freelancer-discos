-- The initial stock-access migration left existing public sequences accessible
-- to anon. Close those grants and preserve normal sequence use for signed-in users.

begin;

revoke all on all sequences in schema public from anon, public;
grant usage, select on all sequences in schema public to authenticated;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, public;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to authenticated;

commit;
