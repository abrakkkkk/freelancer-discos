const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function inspectPatterns() {
  console.log('=== Analisando Padrões do Discogs em Discos (Todas as Lojas) ===');

  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('discos')
      .select('id, artista, titulo, loja, caixa')
      .range(from, from + 999);
    if (error) { console.error(error); break; }
    if (!data || !data.length) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`Total de discos analisados: ${all.length}`);

  // 1. Asteriscos remanescentes
  const comAsterisco = all.filter(d => (d.artista && d.artista.includes('*')) || (d.titulo && d.titulo.includes('*')));
  console.log(`\n1. Discos com asterisco (*) em artista ou título: ${comAsterisco.length}`);

  // 2. Números de desambiguação do Discogs, ex: "Nome (2)", "Artista (3)"
  const comNumeroDesambiguacao = all.filter(d => d.artista && /\s\(\d+\)/.test(d.artista));
  console.log(`\n2. Discos com número de desambiguação do Discogs no artista (ex: "Nome (2)"): ${comNumeroDesambiguacao.length}`);
  console.log('Exemplos de número de desambiguação:');
  comNumeroDesambiguacao.slice(0, 20).forEach(d => {
    console.log(`  ID ${d.id} [${d.loja || 'Sem loja'}]: "${d.artista}" -> Título: "${d.titulo}"`);
  });

  // 3. Caracteres estranhos ou símbolos comuns do Discogs (losangos ◇, etc.)
  const comSimbolos = all.filter(d => (d.artista && /[◇◆★☆]/.test(d.artista)) || (d.titulo && /[◇◆★☆]/.test(d.titulo)));
  console.log(`\n3. Discos com símbolos especiais do Discogs (◇, etc.): ${comSimbolos.length}`);
  comSimbolos.forEach(d => {
    console.log(`  ID ${d.id} [${d.loja}]: "${d.artista}" | "${d.titulo}"`);
  });

  // 4. Verificar também outras tabelas (dvds, cds, vhs)
  console.log('\n=== Analisando outras tabelas ===');
  for (const t of ['cds', 'dvds', 'vhs']) {
    const { data } = await supabase.from(t).select('*');
    if (data && data.length > 0) {
      const ast = data.filter(d => (d.artista && d.artista.includes('*')) || (d.titulo && d.titulo.includes('*')));
      const num = data.filter(d => d.artista && /\s\(\d+\)/.test(d.artista));
      console.log(`Tabela ${t}: total ${data.length} | com asterisco: ${ast.length} | com desambiguação: ${num.length}`);
      if (ast.length > 0) {
        ast.forEach(d => console.log(`  [${t} *]`, d.id, d.artista, d.titulo));
      }
    }
  }
}

inspectPatterns();
