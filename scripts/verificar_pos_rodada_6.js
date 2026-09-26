const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const ids = [7281, 8620, 8754, 9710, 22759, 20918, 21935, 21011, 20909, 23309];
  console.log('--- Verificando amostra da Rodada 6 no Supabase (R$ 200 - R$ 299) ---');
  const { data, error } = await supabase
    .from('discos')
    .select('id, artista, titulo, preco, ano, atualizado_em')
    .in('id', ids);

  if (error) {
    console.error('Erro na consulta:', error);
    return;
  }

  console.table(data);
}

main().catch(console.error);
