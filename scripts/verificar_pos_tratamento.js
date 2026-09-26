const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function verify() {
  const ids = [6987, 8073, 9225, 9642, 6843, 7320, 8058, 14228];
  const { data, error } = await supabase.from('discos').select('id, artista, titulo').in('id', ids);
  console.log('Verificação de amostra no Supabase:');
  data.forEach(d => {
    console.log(`[ID ${d.id}] Artista: "${d.artista}" | Titulo: "${d.titulo}"`);
  });
}
verify();
