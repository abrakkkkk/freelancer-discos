const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const ids = [24705, 17420, 20929, 20955, 21045, 21035, 22701, 22703, 22702, 21012];
  console.log('--- Verificando amostra da Rodada 5 no Supabase ---');
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
