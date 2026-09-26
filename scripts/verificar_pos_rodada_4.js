const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const ids = [14730, 13971, 13800, 13874, 12083, 14098, 13918, 7983, 13632, 11400];
  console.log('--- Verificando amostra da Rodada 4 no Supabase ---');
  const { data, error } = await supabase
    .from('discos')
    .select('id, artista, titulo, atualizado_em')
    .in('id', ids);

  if (error) {
    console.error('Erro na verificação:', error);
    return;
  }

  console.table(data);
}

main().catch(console.error);
