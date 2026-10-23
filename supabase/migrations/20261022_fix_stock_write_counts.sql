-- Keep SQL row counts separate from the number of completed stock operations.
do $migration$
declare
  v_definition text;
  v_old_declaration constant text := 'v_count integer := 0;';
  v_new_declaration constant text := 'v_count integer := 0; v_rows_affected integer;';
  v_old_row_check constant text := 'get diagnostics v_count = row_count; if v_count = 0 then';
  v_new_row_check constant text := 'get diagnostics v_rows_affected = row_count; if v_rows_affected = 0 then';
  v_declaration_matches integer;
  v_row_check_matches integer;
begin
  select pg_get_functiondef(
    'public.stock_write_transaction(text,text,bigint,bigint[],jsonb,jsonb,jsonb,text,jsonb)'::regprocedure
  ) into v_definition;

  v_declaration_matches :=
    (length(v_definition) - length(replace(v_definition, v_old_declaration, ''))) / length(v_old_declaration);
  v_row_check_matches :=
    (length(v_definition) - length(replace(v_definition, v_old_row_check, ''))) / length(v_old_row_check);

  if v_declaration_matches <> 1 or v_row_check_matches <> 4 then
    raise exception 'Unexpected stock transaction function shape (declarations %, row checks %).',
      v_declaration_matches, v_row_check_matches;
  end if;

  v_definition := replace(v_definition, v_old_declaration, v_new_declaration);
  v_definition := replace(v_definition, v_old_row_check, v_new_row_check);
  execute v_definition;
end;
$migration$;
