import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';

import { PGlite } from '@electric-sql/pglite';

const atomicStockMigration = await readFile(
  new URL('../../supabase/migrations/20261022_atomic_stock_operations.sql', import.meta.url),
  'utf8'
);
const dynamicRowCheckMigration = await readFile(
  new URL('../../supabase/migrations/20261022_fix_dynamic_exec_row_checks.sql', import.meta.url),
  'utf8'
);
const stockWriteCountMigration = await readFile(
  new URL('../../supabase/migrations/20261022_fix_stock_write_counts.sql', import.meta.url),
  'utf8'
);

let database;

async function createSchema() {
  await database.exec(`
    create role anon;
    create role authenticated;

    create table public.discos (
      id bigint generated always as identity primary key,
      titulo text not null,
      preco numeric,
      caixa text,
      loja text,
      ativo boolean default true,
      deletado boolean default false,
      quantidade integer default 1,
      observacao text
    );
    create table public.cds (like public.discos including all);
    create table public.dvds (like public.discos including all);
    create table public.vhs (like public.discos including all);

    create table public.movimentacoes (
      id bigint generated always as identity primary key,
      disco_id bigint references public.discos(id),
      cd_id bigint references public.cds(id),
      dvd_id bigint references public.dvds(id),
      vhs_id bigint references public.vhs(id),
      tipo text not null,
      quantidade integer not null default 1,
      observacao text,
      criado_em timestamptz default now()
    );
    create table public.observacoes_disco (
      id bigint generated always as identity primary key,
      disco_id bigint not null references public.discos(id),
      cd_id bigint not null references public.cds(id),
      dvd_id bigint not null references public.dvds(id),
      vhs_id bigint not null references public.vhs(id),
      observacao text,
      criado_em timestamptz default now()
    );
    create view public.caixas_distintas as
      select caixa, loja from public.discos
      union all select caixa, loja from public.cds
      union all select caixa, loja from public.dvds
      union all select caixa, loja from public.vhs;
  `);

  await database.exec(atomicStockMigration);
  await database.exec(dynamicRowCheckMigration);
  await database.exec(stockWriteCountMigration);
}

async function writeStock(action, category, options = {}) {
  const { rows } = await database.query(
    `select public.stock_write_transaction(
      $1::text, $2::text, $3::bigint, $4::bigint[], $5::jsonb,
      $6::jsonb, $7::jsonb, $8::text, $9::jsonb
    ) as result`,
    [
      action,
      category,
      options.itemId ?? null,
      options.ids ? `{${options.ids.join(',')}}` : null,
      options.payload ? JSON.stringify(options.payload) : null,
      options.movement ? JSON.stringify(options.movement) : null,
      options.observation ? JSON.stringify(options.observation) : null,
      options.reason ?? null,
      options.operations ? JSON.stringify(options.operations) : null,
    ]
  );
  return rows[0].result;
}

describe('stock_write_transaction SQL migration', { concurrency: false }, () => {
  before(async () => {
    database = new PGlite();
    await createSchema();
  });

  after(async () => {
    await database.close();
  });

  it('creates an item, movement, and observation atomically with matching foreign keys', async () => {
    const result = await writeStock('create', 'discos', {
      payload: { titulo: 'Teste transacional', quantidade: 2, ativo: true },
      movement: { tipo: 'entrada', quantidade: 2 },
      observation: { observacao: 'Capa íntegra' },
    });

    assert.ok(result.id);
    const { rows: items } = await database.query('select * from discos where id = $1', [result.id]);
    const { rows: movements } = await database.query('select * from movimentacoes where disco_id = $1', [result.id]);
    const { rows: observations } = await database.query('select * from observacoes_disco where disco_id = $1', [result.id]);

    assert.equal(items.length, 1);
    assert.equal(movements.length, 1);
    assert.equal(movements[0].tipo, 'entrada');
    assert.equal(movements[0].quantidade, 2);
    assert.equal(observations.length, 1);
    assert.equal(observations[0].observacao, 'Capa íntegra');
  });

  it('rolls back item insertion when the related movement cannot be inserted', async () => {
    const { rows: before } = await database.query('select count(*)::integer as count from discos');

    await assert.rejects(
      writeStock('create', 'discos', {
        payload: { titulo: 'Não deve permanecer' },
        movement: { tipo: null },
      })
    );

    const { rows: after } = await database.query('select count(*)::integer as count from discos');
    assert.equal(after[0].count, before[0].count);
  });

  it('records a stock exit on deletion of an active item using its stored quantity', async () => {
    const { rows } = await database.query(
      `insert into discos (titulo, ativo, quantidade) values ('Saída', true, 3) returning id`
    );
    const itemId = rows[0].id;

    const result = await writeStock('soft_delete', 'discos', {
      ids: [itemId],
      reason: 'Venda',
    });

    const { rows: itemRows } = await database.query('select deletado from discos where id = $1', [itemId]);
    const { rows: movementRows } = await database.query('select * from movimentacoes where disco_id = $1', [itemId]);
    assert.deepEqual(result, { count: 1 });
    assert.equal(itemRows[0].deletado, true);
    assert.equal(movementRows.length, 1);
    assert.equal(movementRows[0].tipo, 'saida');
    assert.equal(movementRows[0].quantidade, 3);
    assert.equal(movementRows[0].observacao, 'Venda');
  });

  it('returns the correct processed count when deleting and restoring multiple items', async () => {
    const { rows } = await database.query(
      `insert into cds (titulo, ativo, quantidade)
       values ('Lote A', true, 1), ('Lote B', true, 2) returning id`
    );
    const itemIds = rows.map((row) => row.id);

    const deleteResult = await writeStock('soft_delete', 'cds', { ids: itemIds });
    const restoreResult = await writeStock('restore', 'cds', {
      operations: itemIds.map((id) => ({
        id,
        patch: { deletado: false, ativo: true },
        movement: { tipo: 'entrada', observacao: 'Desfazer exclusão' },
      })),
    });

    assert.deepEqual(deleteResult, { count: 2 });
    assert.deepEqual(restoreResult, { count: 2 });
    const { rows: movements } = await database.query(
      'select * from movimentacoes where cd_id = any($1::bigint[])',
      [`{${itemIds.join(',')}}`]
    );
    assert.equal(movements.length, 4);
  });

  it('does not record a stock exit when deleting an inactive reserve', async () => {
    const { rows } = await database.query(
      `insert into cds (titulo, ativo, quantidade) values ('Reserva', false, 2) returning id`
    );
    const itemId = rows[0].id;

    await writeStock('soft_delete', 'cds', { ids: [itemId] });

    const { rows: movements } = await database.query('select * from movimentacoes where cd_id = $1', [itemId]);
    assert.equal(movements.length, 0);
  });

  it('rolls back a bulk update when any requested item does not exist', async () => {
    const { rows } = await database.query(
      `insert into dvds (titulo, caixa) values ('Lote', 'Caixa 1'), ('Outro', 'Caixa 2') returning id`
    );
    const existingIds = rows.map((row) => row.id);
    const missingId = Math.max(...existingIds) + 1000;

    await assert.rejects(
      writeStock('bulk_update', 'dvds', {
        ids: [...existingIds, missingId],
        payload: { caixa: 'Caixa 9' },
      })
    );

    const { rows: unchanged } = await database.query(
      'select caixa from dvds where id = any($1::bigint[]) order by id',
      [`{${existingIds.join(',')}}`]
    );
    assert.deepEqual(unchanged.map((row) => row.caixa), ['Caixa 1', 'Caixa 2']);
  });

  it('promotes an available reserve and adds its movement', async () => {
    const { rows } = await database.query(
      `insert into vhs (titulo, ativo, caixa, loja) values ('Reposição', false, 'Reserva', 'Anexo') returning id`
    );
    const itemId = rows[0].id;

    await writeStock('promote', 'vhs', {
      itemId,
      payload: { caixa: 'Caixa 4B', loja: 'Loja 2' },
      movement: { tipo: 'entrada', quantidade: 1, observacao: 'Reposição' },
    });

    const { rows: promoted } = await database.query('select ativo, caixa, loja from vhs where id = $1', [itemId]);
    const { rows: movements } = await database.query('select * from movimentacoes where vhs_id = $1', [itemId]);
    assert.equal(promoted[0].ativo, true);
    assert.equal(promoted[0].caixa, 'Caixa 4B');
    assert.equal(promoted[0].loja, 'Loja 2');
    assert.equal(movements.length, 1);
    assert.equal(movements[0].tipo, 'entrada');
  });
});
