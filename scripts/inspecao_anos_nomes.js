const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function deepInspect() {
  let all = [];
  let from = 0;
  while (true) {
    const { data } = await supabase.from('discos').select('id, artista, titulo, loja, caixa, ano').range(from, from + 999);
    if (!data || !data.length) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }

  // 1. Título termina com (YYYY), ex: "Fagner (1982)", "Pepeu Gomes (1988)"
  const terminaComAnoParenteses = all.filter(d => d.titulo && /\s*\((19\d{2}|20\d{2})\)\s*$/.test(d.titulo));
  console.log('1. Título termina com (YYYY):', terminaComAnoParenteses.length);

  // 2. Artista termina com YYYY, ex: "Nara Leão 1968"
  const artistaTerminaComAno = all.filter(d => d.artista && /\s+(19\d{2}|20\d{2})$/.test(d.artista));
  console.log('2. Artista termina com YYYY:', artistaTerminaComAno.length);

  // 3. Título termina com " - YYYY", ex: "Face Ácida – 1994"
  const terminaComTracoAno = all.filter(d => d.titulo && /\s+[-–—]\s*(19\d{2}|20\d{2})$/.test(d.titulo));
  console.log('3. Título termina com - YYYY:', terminaComTracoAno.length);

  // 4. Título termina com " YYYY" isolado (sem traço ou parêntese), ex: "Raça Negra 1992"
  const tituloTerminaComAnoIsolado = all.filter(d => d.titulo && /\s+(19\d{2}|20\d{2})$/.test(d.titulo) && !/\((19\d{2}|20\d{2})\)$/.test(d.titulo));
  console.log('4. Título termina com YYYY isolado:', tituloTerminaComAnoIsolado.length);

  console.log('\nExemplos da Categoria 4 (Título termina com YYYY isolado, ex: Raça Negra 1992):');
  tituloTerminaComAnoIsolado.slice(0, 20).forEach(d => {
    console.log(`  ID ${d.id}: "${d.artista}" | "${d.titulo}"`);
  });
}

deepInspect();
