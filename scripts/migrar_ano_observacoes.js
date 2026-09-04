const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, supabaseKey);

async function migrarAnos() {
  console.log('=== Iniciando Migração de Anos (Todas as Lojas) ===\n');

  // 1. Verificar se a coluna ano já existe
  const { error: testColError } = await supabase.from('discos').select('ano').limit(1);
  if (testColError) {
    console.error('ERRO: A coluna "ano" ainda não existe na tabela "discos" do Supabase.');
    console.error('Execute no SQL Editor do Supabase antes de rodar este script:');
    console.error('  ALTER TABLE discos ADD COLUMN IF NOT EXISTS ano text;');
    console.error('  ALTER TABLE cds ADD COLUMN IF NOT EXISTS ano text;');
    console.error('  ALTER TABLE dvds ADD COLUMN IF NOT EXISTS ano text;');
    console.error('  ALTER TABLE vhs ADD COLUMN IF NOT EXISTS ano text;');
    process.exit(1);
  }

  // 2. Buscar todos os discos que possuem observação
  let allDiscosComObs = [];
  let from = 0;
  const step = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('discos')
      .select('id, artista, titulo, loja, caixa, observacao, ano')
      .not('observacao', 'is', null)
      .range(from, from + step - 1);

    if (error) {
      console.error('Erro ao buscar do Supabase:', error);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    allDiscosComObs = allDiscosComObs.concat(data);
    if (data.length < step) break;
    from += step;
  }

  console.log(`Total de discos com observação no banco: ${allDiscosComObs.length}`);

  // Filtrar discos onde a observação contém ano (Ano: YYYY ou 19xx/20xx)
  const discosParaMigrar = [];

  for (const d of allDiscosComObs) {
    const obs = d.observacao || '';
    const matchAno = obs.match(/ano[:\s]+(\d{4})/i) || obs.match(/\b(19\d{2}|20\d{2})\b/);

    if (matchAno) {
      const anoExtraido = matchAno[1];
      // Limpar a menção ao ano da observação
      let novaObs = obs
        .replace(/ano[:\s]+\d{4}/gi, '')
        .replace(/\b(19\d{2}|20\d{2})\b/g, '')
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();

      // Se após remover o ano só sobraram pontuações ou nada, define como null
      if (/^[,\s.\-]*$/.test(novaObs)) {
        novaObs = null;
      }

      discosParaMigrar.push({
        id: d.id,
        loja: d.loja,
        caixa: d.caixa,
        artista: d.artista,
        titulo: d.titulo,
        anoAnterior: d.ano,
        anoNovo: anoExtraido,
        obsAnterior: obs,
        obsNova: novaObs,
      });
    }
  }

  console.log(`Discos identificados para migração de ano: ${discosParaMigrar.length}\n`);

  if (discosParaMigrar.length === 0) {
    console.log('Nenhum disco precisando de migração encontrado.');
    return;
  }

  const logAtualizacoes = [];
  const chunkSize = 25;

  for (let i = 0; i < discosParaMigrar.length; i += chunkSize) {
    const chunk = discosParaMigrar.slice(i, i + chunkSize);

    for (const item of chunk) {
      const { error: updateErr } = await supabase
        .from('discos')
        .update({
          ano: item.anoNovo,
          observacao: item.obsNova,
        })
        .eq('id', item.id);

      if (updateErr) {
        console.error(`Erro ao atualizar ID ${item.id}:`, updateErr.message);
      } else {
        logAtualizacoes.push(item);
      }
    }
    process.stdout.write(`\rProgresso da migração em discos: ${logAtualizacoes.length}/${discosParaMigrar.length}`);
  }

  console.log('\n\nAtualizações na tabela "discos" concluídas com sucesso!');

  // 3. Higienizar tabela observacoes_disco para registros que continham apenas "Ano: YYYY"
  console.log('\n=== Higienizando tabela observacoes_disco ===');
  let allObsHistorico = [];
  from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('observacoes_disco')
      .select('*')
      .range(from, from + step - 1);
    if (error) { console.error(error); break; }
    if (!data || data.length === 0) break;
    allObsHistorico = allObsHistorico.concat(data);
    if (data.length < step) break;
    from += step;
  }

  const obsParaRemover = allObsHistorico.filter((o) => {
    const txt = (o.observacao || '').trim();
    return /^ano[:\s]+\d{4}$/i.test(txt) || /^(19\d{2}|20\d{2})$/.test(txt);
  });

  console.log(`Encontradas ${obsParaRemover.length} entradas em observacoes_disco contendo apenas Ano.`);

  let removidasCount = 0;
  for (let i = 0; i < obsParaRemover.length; i += chunkSize) {
    const chunkIds = obsParaRemover.slice(i, i + chunkSize).map((o) => o.id);
    const { error: delErr } = await supabase
      .from('observacoes_disco')
      .delete()
      .in('id', chunkIds);

    if (delErr) {
      console.error('Erro ao deletar histórico:', delErr.message);
    } else {
      removidasCount += chunkIds.length;
    }
    process.stdout.write(`\rRemovidas de observacoes_disco: ${removidasCount}/${obsParaRemover.length}`);
  }
  console.log('\n');

  // Salvar log
  const logPath = path.resolve(__dirname, 'migracao_ano_log.json');
  fs.writeFileSync(
    logPath,
    JSON.stringify(
      {
        totalDiscosAtualizados: logAtualizacoes.length,
        totalObservacoesHistoricoRemovidas: removidasCount,
        detalhes: logAtualizacoes,
      },
      null,
      2
    ),
    'utf-8'
  );

  console.log(`Log completo de migração salvo em: ${logPath}`);
}

migrarAnos();
