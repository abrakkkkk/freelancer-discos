-- PL/pgSQL EXECUTE does not update FOUND. Use ROW_COUNT for dynamic SELECT/DELETE checks.
-- The original function has four such checks; fail closed if its shape differs.
do $migration$
declare
  v_definition text;
  v_old constant text := 'if not found then';
  v_new constant text := 'get diagnostics v_count = row_count; if v_count = 0 then';
  v_matches integer;
begin
  select pg_get_functiondef(
    'public.stock_write_transaction(text,text,bigint,bigint[],jsonb,jsonb,jsonb,text,jsonb)'::regprocedure
  ) into v_definition;

  v_matches := (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old);
  if v_matches <> 4 then
    raise exception 'Expected four dynamic EXECUTE row checks; found %.', v_matches;
  end if;

  execute replace(v_definition, v_old, v_new);
end;
$migration$;
