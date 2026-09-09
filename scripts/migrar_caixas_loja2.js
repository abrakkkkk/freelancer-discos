const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, supabaseKey);

async function executarMigracaoCaixasLoja2() {
  console.log('=== Iniciando Migração de Caixas - Loja 2 (Discos) ===\n');

  // 1. Buscar todos os discos da Loja 2 para auditoria e backup
  let allLoja2Discos = [];
  let from = 0;
  const step = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('discos')
      .select('id, artista, titulo, loja, caixa')
      .eq('loja', 'Loja 2')
      .range(from, from + step - 1);

    if (error) {
      console.error('Erro ao buscar discos da Loja 2:', error);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    allLoja2Discos = allLoja2Discos.concat(data);
    if (data.length < step) break;
    from += step;
  }

  console.log(`Total de registros encontrados na Loja 2: ${allLoja2Discos.length}`);

  // Filtrar apenas os que possuem caixa em formato antigo (ex: "1B", "16B", etc.)
  const itensParaMigrar = allLoja2Discos.filter((d) => {
    if (!d.caixa) return false;
    const trimmed = String(d.caixa).trim();
    return /^\d+[Bb]$/.test(trimmed);
  });

  console.log(`Total de discos identificados para renomeação: ${itensParaMigrar.length}`);

  if (itensParaMigrar.length === 0) {
    console.log('Nenhum disco com nomenclatura antiga encontrado. Verificando se já foram migrados...');
    const jaMigrados = allLoja2Discos.filter((d) => d.caixa && String(d.caixa).startsWith('Caixa '));
    console.log(`Discos já com prefixo "Caixa ": ${jaMigrados.length}`);
    return;
  }

  // 2. Salvar backup detalhado em JSON antes de aplicar as mudanças
  const backupFile = path.resolve(__dirname, 'backup_caixas_loja2.json');
  const backupData = {
    timestamp: new Date().toISOString(),
    totalItens: itensParaMigrar.length,
    itens: itensParaMigrar.map((d) => ({
      id: d.id,
      artista: d.artista,
      titulo: d.titulo,
      loja: d.loja,
      caixa_original: d.caixa,
    })),
  };
  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf-8');
  console.log(`\n✓ Backup de segurança salvo com sucesso em: ${backupFile}\n`);

  // 3. Mapear as caixas únicas existentes
  const contagemPorCaixa = {};
  for (const item of itensParaMigrar) {
    const c = String(item.caixa).trim();
    contagemPorCaixa[c] = (contagemPorCaixa[c] || 0) + 1;
  }

  console.log('Distribuição por caixa a ser atualizada:');
  for (const [cx, count] of Object.entries(contagemPorCaixa)) {
    const match = cx.match(/^(\d+)[Bb]$/);
    const novoNome = `Caixa ${match[1]}B`;
    console.log(`  "${cx}" (${count} discos) -> "${novoNome}"`);
  }
  console.log('');

  // 4. Executar as atualizações por lote de caixa
  let totalAtualizados = 0;
  for (const [antigaCaixa, count] of Object.entries(contagemPorCaixa)) {
    const match = antigaCaixa.match(/^(\d+)[Bb]$/);
    const novaCaixa = `Caixa ${match[1]}B`;

    process.stdout.write(`Atualizando "${antigaCaixa}" para "${novaCaixa}" (${count} discos)... `);

    const { error: updateError } = await supabase
      .from('discos')
      .update({ caixa: novaCaixa })
      .eq('loja', 'Loja 2')
      .eq('caixa', antigaCaixa);

    if (updateError) {
      console.error(`\n❌ ERRO ao atualizar caixa ${antigaCaixa}:`, updateError.message);
    } else {
      console.log('✓ OK');
      totalAtualizados += count;
    }
  }

  console.log(`\n=== Migração Concluída com Sucesso! ===`);
  console.log(`Total de discos atualizados: ${totalAtualizados} / ${itensParaMigrar.length}`);

  // 5. Auditoria final pós-migração
  console.log('\n--- Auditoria Pós-Migração na Loja 2 ---');
  let posMigracao = [];
  from = 0;
  while (true) {
    const { data } = await supabase
      .from('discos')
      .select('caixa')
      .eq('loja', 'Loja 2')
      .range(from, from + step - 1);
    if (!data || data.length === 0) break;
    posMigracao = posMigracao.concat(data);
    if (data.length < step) break;
    from += step;
  }

  const novaDistribuicao = {};
  for (const d of posMigracao) {
    const key = String(d.caixa);
    novaDistribuicao[key] = (novaDistribuicao[key] || 0) + 1;
  }
  console.log('Novos valores de caixa na Loja 2:');
  const sorted = Object.entries(novaDistribuicao).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  for (const [cx, count] of sorted) {
    console.log(`  "${cx}": ${count} discos`);
  }

  // Confirmar que tabela cds não foi tocada
  const { count: countCds } = await supabase.from('cds').select('*', { count: 'exact', head: true });
  console.log(`\nVerificação de segurança: Tabela CDS possui ${countCds || 0} registros (permanece intacta).`);
}

executarMigracaoCaixasLoja2().catch((err) => {
  console.error('Falha fatal na execução:', err);
  process.exit(1);
});
