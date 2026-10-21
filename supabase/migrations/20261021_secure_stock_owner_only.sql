-- Restrict every stock table to the one authorized Supabase Auth user.
-- This UUID is the existing owner's Auth user ID, not an API credential.

begin;

drop policy if exists estoque_authenticated_all on public.cds;
drop policy if exists estoque_authenticated_all on public.discos;
drop policy if exists estoque_authenticated_all on public.dvds;
drop policy if exists estoque_authenticated_all on public.movimentacoes;
drop policy if exists estoque_authenticated_all on public.observacoes_disco;
drop policy if exists estoque_authenticated_all on public.vhs;

drop policy if exists estoque_owner_only on public.cds;
drop policy if exists estoque_owner_only on public.discos;
drop policy if exists estoque_owner_only on public.dvds;
drop policy if exists estoque_owner_only on public.movimentacoes;
drop policy if exists estoque_owner_only on public.observacoes_disco;
drop policy if exists estoque_owner_only on public.vhs;

create policy estoque_owner_only on public.cds
  for all to authenticated using (auth.uid() = 'ca73f36d-5a03-48e2-89af-a1e8c4832560'::uuid)
  with check (auth.uid() = 'ca73f36d-5a03-48e2-89af-a1e8c4832560'::uuid);
create policy estoque_owner_only on public.discos
  for all to authenticated using (auth.uid() = 'ca73f36d-5a03-48e2-89af-a1e8c4832560'::uuid)
  with check (auth.uid() = 'ca73f36d-5a03-48e2-89af-a1e8c4832560'::uuid);
create policy estoque_owner_only on public.dvds
  for all to authenticated using (auth.uid() = 'ca73f36d-5a03-48e2-89af-a1e8c4832560'::uuid)
  with check (auth.uid() = 'ca73f36d-5a03-48e2-89af-a1e8c4832560'::uuid);
create policy estoque_owner_only on public.movimentacoes
  for all to authenticated using (auth.uid() = 'ca73f36d-5a03-48e2-89af-a1e8c4832560'::uuid)
  with check (auth.uid() = 'ca73f36d-5a03-48e2-89af-a1e8c4832560'::uuid);
create policy estoque_owner_only on public.observacoes_disco
  for all to authenticated using (auth.uid() = 'ca73f36d-5a03-48e2-89af-a1e8c4832560'::uuid)
  with check (auth.uid() = 'ca73f36d-5a03-48e2-89af-a1e8c4832560'::uuid);
create policy estoque_owner_only on public.vhs
  for all to authenticated using (auth.uid() = 'ca73f36d-5a03-48e2-89af-a1e8c4832560'::uuid)
  with check (auth.uid() = 'ca73f36d-5a03-48e2-89af-a1e8c4832560'::uuid);

commit;
