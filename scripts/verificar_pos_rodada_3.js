const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const relatorio = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'relatorio_rodada_3.json'), 'utf8'));
  const amostraIds = [
    13764, // Frank Sinatra & Duke Ellington
    24793, // Ruggero Leoncavallo
    25114, // Patrícia & Luciano, Xuxa, Carequinha
    25252, // Stéphane Grappelli & Jean-Luc Ponty
    25288, // Oscar Peterson & Stéphane Grappelli
    21168, // Os Originais do Samba
    21176, // Solano e Seu Conjunto
    21206  // Percy Faith e Sua Orquestra
  ];

  console.log('--- Verificando registros no Supabase após rodada 3 ---');
  const { data, error } = await supabase
    .from('discos')
    .select('id, artista, titulo, atualizado_em')
    .in('id', amostraIds);

  if (error) {
    console.error('Erro na consulta:', error);
    return;
  }

  console.table(data);

  // Também verificar se ainda existe algum registro ativo com asterisco
  const { data: discosComAsterisco, error: errAsterisco } = await supabase
    .from('discos')
    .select('id, artista, titulo')
    .ilike('artista', '%*%');

  if (errAsterisco) {
    console.error('Erro ao verificar asteriscos:', errAsterisco);
  } else {
    console.log(`Discos com asterisco no artista restantes no banco: ${discosComAsterisco ? discosComAsterisco.length : 0}`);
    if (discosComAsterisco && discosComAsterisco.length > 0) {
      console.log('Restantes:', discosComAsterisco);
    }
  }
}

main().catch(console.error);
