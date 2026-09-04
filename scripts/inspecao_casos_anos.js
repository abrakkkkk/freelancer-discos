const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function inspectCaseD() {
  let all = [];
  let from = 0;
  while (true) {
    const { data } = await supabase.from('discos').select('id, artista, titulo, loja, ano').range(from, from + 999);
    if (!data || !data.length) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  const caseD = all.filter(d => d.titulo && /\s+(19\d{2}|20\d{2})$/.test(d.titulo) && !/\((19\d{2}|20\d{2})\)$/.test(d.titulo));
  console.log('Total Case D (títulos terminando em YYYY):', caseD.length);

  caseD.slice(0, 30).forEach(d => {
    const match = d.titulo.match(/\s+(19\d{2}|20\d{2})$/);
    const semAno = d.titulo.replace(/\s+(19\d{2}|20\d{2})$/, '').trim();
    console.log(`ID ${d.id} [${d.loja || 'Sem loja'}]: Artista: "${d.artista}" | Titulo: "${d.titulo}" -> Ano: ${match[1]} | Titulo limpo: "${semAno}"`);
  });
}

inspectCaseD();
