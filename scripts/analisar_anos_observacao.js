const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function inspectObservacoes() {
  console.log('=== Analisando Observações em Discos ===');

  let allDiscos = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('discos')
      .select('id, artista, titulo, loja, caixa, observacao')
      .range(from, from + 999);
    if (error) { console.error(error); break; }
    if (!data || data.length === 0) break;
    allDiscos = allDiscos.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`Total de discos analisados: ${allDiscos.length}`);

  const discosComObs = allDiscos.filter(d => d.observacao && d.observacao.trim().length > 0);
  console.log(`Discos com campo observacao preenchido: ${discosComObs.length}`);

  // Patterns to look for: "Ano: YYYY", "YYYY", etc.
  const discosComAno = [];
  for (const d of discosComObs) {
    const obs = d.observacao;
    // Match "Ano: 1982", "Ano 1982", or isolated year 19xx/20xx
    const matchAnoPrefix = obs.match(/ano[:\s]+(\d{4})/i);
    const matchYearNumber = obs.match(/\b(19\d{2}|20\d{2})\b/);
    
    if (matchAnoPrefix || matchYearNumber) {
      discosComAno.push({
        id: d.id,
        loja: d.loja,
        artista: d.artista,
        titulo: d.titulo,
        observacao: obs,
        anoExtraido: matchAnoPrefix ? matchAnoPrefix[1] : matchYearNumber[1],
        temOutroConteudo: obs.replace(/ano[:\s]+\d{4}/gi, '').replace(/\b(19\d{2}|20\d{2})\b/g, '').trim().length > 0
      });
    }
  }

  console.log(`Discos onde observação contém ano: ${discosComAno.length}`);
  console.log('\nExemplos encontrados em discos.observacao:');
  discosComAno.slice(0, 30).forEach(d => {
    console.log(`ID ${d.id} [${d.loja || 'Sem loja'}]: "${d.observacao}" -> Ano: ${d.anoExtraido} (Outro conteúdo? ${d.temOutroConteudo})`);
  });

  // Também verificar observacoes_disco
  console.log('\n=== Analisando Tabela observacoes_disco ===');
  let allObsDisco = [];
  from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('observacoes_disco')
      .select('*')
      .range(from, from + 999);
    if (error) { console.error(error); break; }
    if (!data || data.length === 0) break;
    allObsDisco = allObsDisco.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`Total em observacoes_disco: ${allObsDisco.length}`);

  const obsDiscoComAno = [];
  for (const o of allObsDisco) {
    const obs = o.observacao || '';
    const matchAnoPrefix = obs.match(/ano[:\s]+(\d{4})/i);
    const matchYearNumber = obs.match(/\b(19\d{2}|20\d{2})\b/);
    if (matchAnoPrefix || matchYearNumber) {
      obsDiscoComAno.push({
        id: o.id,
        disco_id: o.disco_id,
        observacao: obs,
        anoExtraido: matchAnoPrefix ? matchAnoPrefix[1] : matchYearNumber[1],
        temOutroConteudo: obs.replace(/ano[:\s]+\d{4}/gi, '').replace(/\b(19\d{2}|20\d{2})\b/g, '').trim().length > 0
      });
    }
  }
  console.log(`Registros em observacoes_disco com ano: ${obsDiscoComAno.length}`);
  obsDiscoComAno.slice(0, 20).forEach(o => {
    console.log(`Obs ID ${o.id}, disco_id ${o.disco_id}: "${o.observacao}" -> Ano: ${o.anoExtraido} (Outro conteúdo? ${o.temOutroConteudo})`);
  });

  // Verificar outras categorias (cds, dvds, vhs)
  for (const cat of ['dvds', 'cds', 'vhs']) {
    const { data } = await supabase.from(cat).select('id, titulo, loja, observacao').not('observacao', 'is', null);
    if (data && data.length > 0) {
      const comAno = data.filter(d => /\b(19\d{2}|20\d{2})\b/.test(d.observacao));
      console.log(`\nTabela ${cat}: ${data.length} com obs, ${comAno.length} com ano.`);
    }
  }
}

inspectObservacoes();
