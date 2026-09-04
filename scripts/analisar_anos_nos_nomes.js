const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function findYearsInNames() {
  console.log('=== Analisando Anos nos Títulos e Nomes de Artistas (Todas as Lojas) ===');

  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('discos')
      .select('id, artista, titulo, loja, caixa, ano')
      .range(from, from + 999);
    if (error) { console.error('Erro ao buscar:', error.message); break; }
    if (!data || !data.length) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`Total de discos analisados: ${all.length}`);

  // Padrões de anos:
  // 1. Parênteses: (19xx) ou (20xx)
  // 2. Colchetes: [19xx] ou [20xx]
  // 3. Final do título: " - 19xx" ou " 19xx"
  // 4. No meio do título ou do artista
  const anoRegexParenteses = /\((19\d{2}|20\d{2})\)/;
  const anoRegexColchetes = /\[(19\d{2}|20\d{2})\]/;
  const anoRegexTraco = /[-–—]\s*(19\d{2}|20\d{2})\b/;
  const anoRegexFinal = /\b(19\d{2}|20\d{2})\s*$/;
  const anoRegexQualquer = /\b(19\d{2}|20\d{2})\b/;

  const comAnoParentesesTitulo = all.filter(d => d.titulo && anoRegexParenteses.test(d.titulo));
  const comAnoColchetesTitulo = all.filter(d => d.titulo && anoRegexColchetes.test(d.titulo));
  const comAnoTracoTitulo = all.filter(d => d.titulo && anoRegexTraco.test(d.titulo));
  const comAnoQualquerTitulo = all.filter(d => d.titulo && anoRegexQualquer.test(d.titulo));
  const comAnoQualquerArtista = all.filter(d => d.artista && anoRegexQualquer.test(d.artista));

  console.log(`\nDiscos com "(YYYY)" no Título: ${comAnoParentesesTitulo.length}`);
  console.log(`Discos com "[YYYY]" no Título: ${comAnoColchetesTitulo.length}`);
  console.log(`Discos com "- YYYY" no Título: ${comAnoTracoTitulo.length}`);
  console.log(`Discos com qualquer "YYYY" (19xx/20xx) no Título: ${comAnoQualquerTitulo.length}`);
  console.log(`Discos com qualquer "YYYY" no Artista: ${comAnoQualquerArtista.length}`);

  console.log('\n--- Exemplos com "(YYYY)" no Título (primeiros 25): ---');
  comAnoParentesesTitulo.slice(0, 25).forEach(d => {
    const match = d.titulo.match(anoRegexParenteses);
    console.log(`ID ${d.id} [${d.loja}]: "${d.artista}" | "${d.titulo}" -> Ano extraído: ${match[1]} (Ano atual no banco: ${d.ano || 'null'})`);
  });

  console.log('\n--- Exemplos com "- YYYY" ou "[YYYY]" no Título: ---');
  comAnoTracoTitulo.slice(0, 15).forEach(d => {
    const match = d.titulo.match(anoRegexTraco);
    console.log(`ID ${d.id} [${d.loja}]: "${d.artista}" | "${d.titulo}" -> Ano extraído: ${match[1]} (Ano atual: ${d.ano || 'null'})`);
  });

  console.log('\n--- Exemplos com "YYYY" no Artista: ---');
  comAnoQualquerArtista.slice(0, 15).forEach(d => {
    const match = d.artista.match(anoRegexQualquer);
    console.log(`ID ${d.id} [${d.loja}]: "${d.artista}" | "${d.titulo}" -> Ano: ${match[1]} (Ano atual: ${d.ano || 'null'})`);
  });
}

findYearsInNames();
