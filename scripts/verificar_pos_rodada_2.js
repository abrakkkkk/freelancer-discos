const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function verify() {
  const ids = [7035, 7839, 8104, 8219, 8366, 9078, 9595, 11879, 12915, 14247];
  const { data, error } = await supabase.from('discos').select('id, artista, titulo').in('id', ids);
  console.log('Verificação de amostra da 2ª rodada no Supabase:');
  data.forEach(d => {
    console.log(`[ID ${d.id}] Artista: "${d.artista}" | Titulo: "${d.titulo}"`);
  });
}
verify();
