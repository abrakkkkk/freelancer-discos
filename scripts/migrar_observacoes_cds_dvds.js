const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, supabaseKey);

async function migrar() {
  console.log('=== Verificação e Migração de Observações (CDs, DVDs, VHS) ===\n');

  // 1. Testa se a restrição NOT NULL de disco_id já foi removida
  console.log('1. Verificando se disco_id já aceita valores nulos em observacoes_disco...');
  const testRes = await supabase.from('observacoes_disco').insert({
    observacao: '__TESTE_RESTRICAO_TEMP__',
    cd_id: 1,
    disco_id: null
  }).select();

  if (testRes.error && testRes.error.code === '23502') {
    console.error('\n❌ ERRO: A coluna "disco_id" da tabela "observacoes_disco" AINDA possui a restrição NOT NULL!');
    console.error('Execute no SQL Editor do Supabase antes de prosseguir:\n');
    console.error('  ALTER TABLE public.observacoes_disco ALTER COLUMN disco_id DROP NOT NULL;');
    console.error('  CREATE INDEX IF NOT EXISTS idx_obs_disco_disco_id ON public.observacoes_disco (disco_id);');
    console.error('  CREATE INDEX IF NOT EXISTS idx_obs_disco_cd_id ON public.observacoes_disco (cd_id);');
    console.error('  CREATE INDEX IF NOT EXISTS idx_obs_disco_dvd_id ON public.observacoes_disco (dvd_id);');
    console.error('  CREATE INDEX IF NOT EXISTS idx_obs_disco_vhs_id ON public.observacoes_disco (vhs_id);\n');
    console.error('(O arquivo fix_observacoes_disco.sql foi salvo na raiz do projeto para sua conveniência.)\n');
    process.exit(1);
  }

  // Se o teste inseriu, limpa o registro de teste
  if (testRes.data && testRes.data.length > 0) {
    const testId = testRes.data[0].id;
    await supabase.from('observacoes_disco').delete().eq('id', testId);
    console.log('✅ Validação OK: disco_id já permite nulo!\n');
  }

  // 2. Migrar observações legadas das tabelas cds, dvds, vhs para observacoes_disco
  console.log('2. Migrando observações legadas existentes...');
  const categorias = [
    { table: 'cds', field: 'cd_id' },
    { table: 'dvds', field: 'dvd_id' },
    { table: 'vhs', field: 'vhs_id' }
  ];

  let totalMigrados = 0;

  for (const { table, field } of categorias) {
    const { data: itens, error } = await supabase
      .from(table)
      .select('id, titulo, observacao, created_at')
      .not('observacao', 'is', null);

    if (error) {
      console.error(`Erro ao consultar ${table}:`, error.message);
      continue;
    }

    if (!itens || itens.length === 0) {
      console.log(`Nenhuma observação legada encontrada em "${table}".`);
      continue;
    }

    console.log(`Encontradas ${itens.length} observações em "${table}". Sincronizando...`);

    for (const item of itens) {
      if (!item.observacao || !item.observacao.trim()) continue;

      // Verifica se já existe em observacoes_disco para não duplicar
      const { data: existentes } = await supabase
        .from('observacoes_disco')
        .select('id')
        .eq(field, item.id)
        .eq('observacao', item.observacao.trim())
        .limit(1);

      if (!existentes || existentes.length === 0) {
        const { error: insErr } = await supabase.from('observacoes_disco').insert({
          [field]: item.id,
          observacao: item.observacao.trim(),
          criado_em: item.created_at || new Date().toISOString()
        });

        if (insErr) {
          console.error(`  Erro ao migrar item ${item.id} (${item.titulo}):`, insErr.message);
        } else {
          totalMigrados++;
          console.log(`  ✓ ${table.toUpperCase()} [ID ${item.id}] "${item.titulo}": "${item.observacao}"`);
        }
      }
    }
  }

  console.log(`\n🎉 Migração finalizada com sucesso! Total de novas observações migradas: ${totalMigrados}\n`);
}

migrar();
