-- Keep stock mutations and their audit rows inside one PostgreSQL transaction.
-- These SECURITY INVOKER functions retain the caller's RLS and table privileges.

begin;

-- Each observation references exactly one media table, so unrelated FK columns
-- must allow NULL for CDs, DVDs, and VHS records to be stored correctly.
alter table public.observacoes_disco
  alter column disco_id drop not null,
  alter column cd_id drop not null,
  alter column dvd_id drop not null,
  alter column vhs_id drop not null;

-- This security-invoker view still depends on the invoker's table privileges,
-- but default view grants should not expose write operations to anon/public.
revoke all on table public.caixas_distintas from public, anon;
grant select on table public.caixas_distintas to authenticated;

create or replace function public.stock_insert_record(p_table text, p_row jsonb)
returns bigint
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_relation regclass;
  v_columns text;
  v_values text;
  v_id bigint;
begin
  if p_table not in ('discos', 'cds', 'dvds', 'vhs', 'movimentacoes', 'observacoes_disco') then
    raise exception 'Tabela de estoque não permitida.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_row) is distinct from 'object' or p_row = '{}'::jsonb then
    raise exception 'Registro inválido.' using errcode = '22023';
  end if;

  v_relation := to_regclass(format('public.%I', p_table));
  if v_relation is null then
    raise exception 'Tabela public.% não existe.', p_table using errcode = '42P01';
  end if;

  select
    string_agg(format('%I', item.key), ', ' order by item.key),
    string_agg(
      format('(jsonb_populate_record(NULL::%s, $1)).%I', v_relation, item.key),
      ', ' order by item.key
    )
  into v_columns, v_values
  from jsonb_object_keys(p_row) as item(key);

  execute format(
    'insert into public.%I (%s) select %s returning id',
    p_table, v_columns, v_values
  ) into v_id using p_row;

  return v_id;
end;
$$;

create or replace function public.stock_update_record(p_category text, p_item_id bigint, p_patch jsonb)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_relation regclass;
  v_assignments text;
  v_updated integer;
begin
  if p_category is null or p_category not in ('discos', 'cds', 'dvds', 'vhs') then
    raise exception 'Categoria de estoque não permitida.' using errcode = '22023';
  end if;
  if p_item_id is null or jsonb_typeof(p_patch) is distinct from 'object' or p_patch = '{}'::jsonb or p_patch ? 'id' then
    raise exception 'Atualização inválida.' using errcode = '22023';
  end if;

  v_relation := to_regclass(format('public.%I', p_category));
  if v_relation is null then
    raise exception 'Tabela public.% não existe.', p_category using errcode = '42P01';
  end if;

  select string_agg(
    format('%1$I = (jsonb_populate_record(NULL::%2$s, $1)).%1$I', item.key, v_relation),
    ', ' order by item.key
  )
  into v_assignments
  from jsonb_object_keys(p_patch) as item(key);

  execute format('update public.%I set %s where id = $2', p_category, v_assignments)
    using p_patch, p_item_id;
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'O item % não existe ou não está acessível.', p_item_id using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.stock_write_transaction(
  p_action text,
  p_category text,
  p_item_id bigint default null,
  p_ids bigint[] default null,
  p_payload jsonb default null,
  p_movement jsonb default null,
  p_observation jsonb default null,
  p_reason text default null,
  p_operations jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_fk text;
  v_id bigint;
  v_count integer := 0;
  v_expected integer;
  v_item record;
  v_operation jsonb;
  v_inserted_id bigint;
  v_latest_observation text;
begin
  if p_category is null or p_category not in ('discos', 'cds', 'dvds', 'vhs') then
    raise exception 'Categoria de estoque não permitida.' using errcode = '22023';
  end if;

  v_fk := case p_category
    when 'discos' then 'disco_id'
    when 'cds' then 'cd_id'
    when 'dvds' then 'dvd_id'
    when 'vhs' then 'vhs_id'
  end;

  if p_action = 'create' then
    v_inserted_id := public.stock_insert_record(p_category, p_payload);
    perform public.stock_insert_record(
      'movimentacoes',
      coalesce(p_movement, '{}'::jsonb) || jsonb_build_object(v_fk, v_inserted_id)
    );
    if p_observation is not null and p_observation <> '{}'::jsonb then
      perform public.stock_insert_record(
        'observacoes_disco',
        p_observation || jsonb_build_object(v_fk, v_inserted_id)
      );
    end if;
    return jsonb_build_object('id', v_inserted_id);
  elsif p_action = 'add_observation' then
    if p_item_id is null or jsonb_typeof(p_observation) is distinct from 'object' or p_observation = '{}'::jsonb then
      raise exception 'Observação inválida.' using errcode = '22023';
    end if;
    perform public.stock_update_record(p_category, p_item_id, p_payload);
    v_inserted_id := public.stock_insert_record(
      'observacoes_disco',
      p_observation || jsonb_build_object(v_fk, p_item_id)
    );
    return jsonb_build_object('id', v_inserted_id);
  elsif p_action = 'delete_observation' then
    if p_item_id is null or p_ids is null or cardinality(p_ids) <> 1 then
      raise exception 'Exclusão de observação inválida.' using errcode = '22023';
    end if;
    execute format(
      'delete from public.observacoes_disco where id = $1 and %I = $2 returning id',
      v_fk
    ) into v_inserted_id using p_ids[1], p_item_id;
    if not found then
      raise exception 'A observação não existe ou não pertence a este item.' using errcode = 'P0002';
    end if;
    execute format(
      'select observacao from public.observacoes_disco where %I = $1 order by criado_em desc nulls last, id desc limit 1',
      v_fk
    ) into v_latest_observation using p_item_id;
    perform public.stock_update_record(
      p_category,
      p_item_id,
      jsonb_build_object('observacao', v_latest_observation)
    );
    return jsonb_build_object('id', v_inserted_id);
  elsif p_action = 'soft_delete' then
    if p_ids is null or cardinality(p_ids) = 0 then
      return jsonb_build_object('count', 0);
    end if;
    select count(distinct id) into v_expected from unnest(p_ids) as ids(id);

    for v_id in select distinct id from unnest(p_ids) as ids(id) loop
      execute format(
        'select stock_row.id, coalesce(stock_row.ativo, true) as ativo, coalesce(nullif(to_jsonb(stock_row)->>''quantidade'', '''')::integer, 1) as quantidade from public.%I as stock_row where stock_row.id = $1 and coalesce(stock_row.deletado, false) = false for update',
        p_category
      ) into v_item using v_id;
      if not found then
        raise exception 'O item % não existe, já foi excluído ou não está acessível.', v_id using errcode = 'P0002';
      end if;

      perform public.stock_update_record(p_category, v_id, '{"deletado":true}'::jsonb);
      if v_item.ativo then
        perform public.stock_insert_record(
          'movimentacoes',
          jsonb_build_object(
            v_fk, v_id,
            'tipo', 'saida',
            'quantidade', v_item.quantidade,
            'observacao', coalesce(p_reason, 'Saída (Excluído)')
          )
        );
      end if;
      v_count := v_count + 1;
    end loop;
    return jsonb_build_object('count', v_count);
  elsif p_action = 'bulk_update' then
    if p_ids is null or cardinality(p_ids) = 0 then
      return jsonb_build_object('count', 0);
    end if;
    if jsonb_typeof(p_payload) is distinct from 'object' or p_payload = '{}'::jsonb or p_payload ? 'id' then
      raise exception 'Atualização em lote inválida.' using errcode = '22023';
    end if;
    select count(distinct id) into v_expected from unnest(p_ids) as ids(id);
    execute format('update public.%I set %s where id = any($2)', p_category, (
      select string_agg(
        format('%1$I = (jsonb_populate_record(NULL::%2$s, $1)).%1$I', item.key, to_regclass(format('public.%I', p_category))),
        ', ' order by item.key
      ) from jsonb_object_keys(p_payload) as item(key)
    )) using p_payload, p_ids;
    get diagnostics v_count = row_count;
    if v_count <> v_expected then
      raise exception 'Nem todos os itens selecionados existem ou estão acessíveis.' using errcode = 'P0002';
    end if;
    return jsonb_build_object('count', v_count);
  elsif p_action = 'promote' then
    if p_item_id is null then
      raise exception 'Item de reposição inválido.' using errcode = '22023';
    end if;
    execute format(
      'select id from public.%I where id = $1 and ativo = false and coalesce(deletado, false) = false for update',
      p_category
    ) into v_id using p_item_id;
    if not found then
      raise exception 'A cópia reserva não está mais disponível.' using errcode = 'P0002';
    end if;

    perform public.stock_update_record(p_category, p_item_id, p_payload || jsonb_build_object('ativo', true));
    perform public.stock_insert_record(
      'movimentacoes',
      coalesce(p_movement, '{}'::jsonb) || jsonb_build_object(v_fk, p_item_id)
    );
    return jsonb_build_object('id', p_item_id);
  elsif p_action = 'restore' then
    if jsonb_typeof(p_operations) is distinct from 'array' then
      raise exception 'Operações de restauração inválidas.' using errcode = '22023';
    end if;
    for v_operation in select value from jsonb_array_elements(p_operations) loop
      v_id := (v_operation ->> 'id')::bigint;
      execute format(
        'select coalesce(nullif(to_jsonb(stock_row)->>''quantidade'', '''')::integer, 1) as quantidade from public.%I as stock_row where stock_row.id = $1 for update',
        p_category
      ) into v_item using v_id;
      if not found then
        raise exception 'O item % não existe ou não está acessível.', v_id using errcode = 'P0002';
      end if;
      perform public.stock_update_record(p_category, v_id, v_operation -> 'patch');
      if v_operation ? 'movement' and v_operation -> 'movement' <> 'null'::jsonb then
        perform public.stock_insert_record(
          'movimentacoes',
          (v_operation -> 'movement') || jsonb_build_object(v_fk, v_id, 'quantidade', v_item.quantidade)
        );
      end if;
      v_count := v_count + 1;
    end loop;
    return jsonb_build_object('count', v_count);
  else
    raise exception 'Operação de estoque não permitida.' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.stock_insert_record(text, jsonb) from public, anon;
revoke all on function public.stock_update_record(text, bigint, jsonb) from public, anon;
revoke all on function public.stock_write_transaction(text, text, bigint, bigint[], jsonb, jsonb, jsonb, text, jsonb) from public, anon;
grant execute on function public.stock_insert_record(text, jsonb) to authenticated;
grant execute on function public.stock_update_record(text, bigint, jsonb) to authenticated;
grant execute on function public.stock_write_transaction(text, text, bigint, bigint[], jsonb, jsonb, jsonb, text, jsonb) to authenticated;

commit;
