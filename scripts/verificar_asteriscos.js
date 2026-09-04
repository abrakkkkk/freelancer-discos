const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const DISCOGS_KEY = process.env.DISCOGS_KEY;
const DISCOGS_SECRET = process.env.DISCOGS_SECRET;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchFromDiscogs(url) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Discogs key=${DISCOGS_KEY}, secret=${DISCOGS_SECRET}`,
      'User-Agent': 'FreelancerDiscosAudit/1.0',
    },
  });

  if (response.status === 429) {
    console.log('  [Discogs Rate Limit] Aguardando 10 segundos...');
    await sleep(10000);
    return fetchFromDiscogs(url);
  }

  if (!response.ok) {
    throw new Error(`Discogs API retornou status ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function auditarDiscosLoja2() {
  console.log('=== Iniciando Auditoria de Asteriscos - Discos Loja 2 ===\n');

  // 1. Buscar todos os discos da Loja 2
  let allLoja2 = [];
  let from = 0;
  const step = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('discos')
      .select('id, artista, titulo, loja, caixa, preco')
      .eq('loja', 'Loja 2')
      .range(from, from + step - 1);

    if (error) {
      console.error('Erro ao buscar do Supabase:', error);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    allLoja2 = allLoja2.concat(data);
    if (data.length < step) break;
    from += step;
  }

  // 2. Filtrar itens com asterisco
  const itensComAsterisco = allLoja2.filter(
    (d) => (d.artista && d.artista.includes('*')) || (d.titulo && d.titulo.includes('*'))
  );

  console.log(`Total de discos na Loja 2: ${allLoja2.length}`);
  console.log(`Total de discos com asterisco: ${itensComAsterisco.length}\n`);

  const relatorio = [];

  for (let i = 0; i < itensComAsterisco.length; i++) {
    const item = itensComAsterisco[i];
    console.log(`[${i + 1}/${itensComAsterisco.length}] Analisando ID ${item.id}: "${item.artista}" - "${item.titulo}"`);

    const asteriscoNoArtista = item.artista ? item.artista.includes('*') : false;
    const asteriscoNoTitulo = item.titulo ? item.titulo.includes('*') : false;

    // Busca no Discogs sem os asteriscos para localizar a release original
    const termoBuscaArtista = (item.artista || '').replace(/\*/g, '').trim();
    const termoBuscaTitulo = (item.titulo || '').replace(/\*/g, '').trim();
    const query = encodeURIComponent(`${termoBuscaArtista} ${termoBuscaTitulo}`);

    let releaseData = null;
    let tituloOficialDiscogs = null;
    let artistasOficiaisDiscogs = [];
    let asteriscoPertenceAoTituloReal = false;
    let detalhesANV = [];

    try {
      // 1000ms delay para respeitar o rate limit da API do Discogs
      await sleep(1000);

      const searchResult = await fetchFromDiscogs(
        `https://api.discogs.com/database/search?q=${query}&type=release&per_page=3`
      );

      if (searchResult.results && searchResult.results.length > 0) {
        const topResult = searchResult.results[0];
        const releaseId = topResult.id;

        await sleep(1000);
        releaseData = await fetchFromDiscogs(`https://api.discogs.com/releases/${releaseId}`);

        tituloOficialDiscogs = releaseData.title;
        artistasOficiaisDiscogs = (releaseData.artists || []).map((a) => ({
          name: a.name,
          anv: a.anv,
          join: a.join,
        }));

        detalhesANV = artistasOficiaisDiscogs.filter((a) => a.anv);

        // O asterisco pertence ao título real se o título oficial do lançamento na base de dados tiver *
        if (tituloOficialDiscogs && tituloOficialDiscogs.includes('*')) {
          asteriscoPertenceAoTituloReal = true;
        }
      }
    } catch (err) {
      console.warn(`  Aviso ao consultar Discogs para ID ${item.id}:`, err.message);
    }

    const diagnostico = {
      id: item.id,
      loja: item.loja,
      caixa: item.caixa,
      artistaOriginal: item.artista,
      tituloOriginal: item.titulo,
      artistaLimpo: (item.artista || '').replace(/\*/g, '').trim(),
      tituloLimpo: (item.titulo || '').replace(/\*/g, '').trim(),
      asteriscoNoArtista,
      asteriscoNoTitulo,
      tituloOficialDiscogs,
      artistasOficiaisDiscogs,
      detalhesANV,
      asteriscoPertenceAoTituloReal,
      motivo: asteriscoPertenceAoTituloReal
        ? 'O asterisco pertence legitimamente ao título oficial da obra.'
        : 'Asterisco gerado por marcação interna de ANV (Artist Name Variation) do Discogs.',
    };

    relatorio.push(diagnostico);

    console.log(`  -> Título oficial Discogs: "${tituloOficialDiscogs || 'N/A'}"`);
    console.log(`  -> Pertence ao título real? ${asteriscoPertenceAoTituloReal ? 'SIM' : 'NÃO'}`);
    console.log(`  -> Diagnóstico: ${diagnostico.motivo}\n`);
  }

  const outputPath = path.resolve(__dirname, 'relatorio_asteriscos.json');
  fs.writeFileSync(outputPath, JSON.stringify(relatorio, null, 2), 'utf-8');
  console.log(`\nRelatório salvo com sucesso em: ${outputPath}`);

  const pertencemAoTitulo = relatorio.filter((r) => r.asteriscoPertenceAoTituloReal);
  console.log('\n=== Resumo da Auditoria ===');
  console.log(`Total analisados: ${relatorio.length}`);
  console.log(`Asteriscos legítimos do título: ${pertencemAoTitulo.length}`);
  console.log(`Asteriscos espúrios do Discogs (ANV): ${relatorio.length - pertencemAoTitulo.length}`);
}

auditarDiscosLoja2();
