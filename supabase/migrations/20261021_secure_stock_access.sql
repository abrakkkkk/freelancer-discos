-- Apply only after:
-- 1. The app is deployed with Supabase Auth enabled.
-- 2. The single intended Auth user has been created and tested.
-- 3. Public sign-ups are disabled in Supabase Auth settings.
-- This migration removes the current anonymous stock access.

begin;

alter table public.cds enable row level security;
alter table public.discos enable row level security;
alter table public.dvds enable row level security;
alter table public.movimentacoes enable row level security;
alter table public.observacoes_disco enable row level security;
alter table public.vhs enable row level security;

drop policy if exists "Permitir acesso total via anon" on public.cds;
drop policy if exists "Permitir acesso total via anon" on public.discos;
drop policy if exists "Permitir leitura de discos" on public.discos;
drop policy if exists "Permitir acesso total via anon" on public.dvds;
drop policy if exists "Permitir acesso total via anon" on public.movimentacoes;
drop policy if exists "Permitir escrita de movimentacoes" on public.movimentacoes;
drop policy if exists "Permitir leitura de movimentacoes" on public.movimentacoes;
drop policy if exists "Permitir acesso total via anon" on public.observacoes_disco;
drop policy if exists "Permitir tudo para observacoes" on public.observacoes_disco;
drop policy if exists "Permitir acesso público anon" on public.vhs;

revoke all on table
  public.cds,
  public.discos,
  public.dvds,
  public.movimentacoes,
  public.observacoes_disco,
  public.vhs
from anon, public;

grant select, insert, update, delete on table
  public.cds,
  public.discos,
  public.dvds,
  public.movimentacoes,
  public.observacoes_disco,
  public.vhs
to authenticated;

grant usage, select on all sequences in schema public to authenticated;

create policy estoque_authenticated_all on public.cds
  for all to authenticated using (true) with check (true);
create policy estoque_authenticated_all on public.discos
  for all to authenticated using (true) with check (true);
create policy estoque_authenticated_all on public.dvds
  for all to authenticated using (true) with check (true);
create policy estoque_authenticated_all on public.movimentacoes
  for all to authenticated using (true) with check (true);
create policy estoque_authenticated_all on public.observacoes_disco
  for all to authenticated using (true) with check (true);
create policy estoque_authenticated_all on public.vhs
  for all to authenticated using (true) with check (true);

alter function public.get_distinct_caixas(text) security invoker;
alter function public.get_distinct_caixas(text) set search_path = pg_catalog, public;
revoke execute on function public.get_distinct_caixas(text) from public, anon;
grant execute on function public.get_distinct_caixas(text) to authenticated;

commit;
