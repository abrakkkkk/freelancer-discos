const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function searchAllTables() {
  const tables = ['discos', 'cds', 'dvds', 'vhs', 'observacoes_disco', 'movimentacoes'];
  for (const t of tables) {
    let all = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase.from(t).select('*').range(from, from + 999);
      if (error) { console.error('Erro na tabela', t, error.message); break; }
      if (!data || !data.length) break;
      all = all.concat(data);
      if (data.length < 1000) break;
      from += 1000;
    }
    const withAst = all.filter(row => JSON.stringify(row).includes('*'));
    console.log(`Tabela ${t}: ${all.length} linhas | contendo '*': ${withAst.length}`);
    if (withAst.length > 0) {
      withAst.slice(0, 5).forEach(r => console.log('  Exemplo:', r));
    }
  }
}

searchAllTables();
