/**
 * migrar_capa_url.js
 * Script para verificar a existência da coluna 'capa_url' no Supabase
 * e sincronizar todas as capas conhecidas dos discos para o banco de dados.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, supabaseKey);

async function main() {
  console.log('=== Verificação e Sincronização de Capas no Supabase ===\n');

  // 1. Testa se a coluna capa_url já foi criada no Supabase
  const { error: testError } = await supabase.from('discos').select('capa_url').limit(1);

  if (testError) {
    console.log('⚠️ A coluna "capa_url" ainda não existe na tabela "discos".');
    console.log('\nPor favor, execute o seguinte comando no SQL Editor do Supabase:');
    console.log('------------------------------------------------------------');
    console.log('ALTER TABLE discos ADD COLUMN IF NOT EXISTS capa_url text;');
    console.log('ALTER TABLE cds ADD COLUMN IF NOT EXISTS capa_url text;');
    console.log('ALTER TABLE dvds ADD COLUMN IF NOT EXISTS capa_url text;');
    console.log('ALTER TABLE vhs ADD COLUMN IF NOT EXISTS capa_url text;');
    console.log('------------------------------------------------------------\n');
    process.exit(1);
  }

  console.log('✅ Coluna "capa_url" encontrada na tabela "discos"!');
  console.log('Sincronizando capas do catálogo local para o Supabase...');

  // 2. Carrega as capas conhecidas de data/discos.json e do cache principal
  const discosJsonPath = path.resolve(__dirname, '../site-loja/data/discos.json');
  let discosLocais = [];
  if (fs.existsSync(discosJsonPath)) {
    try {
      discosLocais = JSON.parse(fs.readFileSync(discosJsonPath, 'utf8'));
    } catch (_) {}
  }

  const comCapa = discosLocais.filter(d => d.id && d.capa_url);
  console.log(`Encontrados ${comCapa.length} discos com capa para sincronizar no Supabase.`);

  let atualizados = 0;
  for (const disco of comCapa) {
    const { error: updErr } = await supabase
      .from('discos')
      .update({ capa_url: disco.capa_url })
      .eq('id', disco.id);

    if (!updErr) {
      atualizados++;
      if (atualizados % 25 === 0) {
        process.stdout.write(`  ✓ ${atualizados}/${comCapa.length} capas sincronizadas...\n`);
      }
    }
  }

  console.log(`\n🎉 Concluído! ${atualizados} discos agora possuem capa salva diretamente no Supabase.`);
}

main().catch(err => {
  console.error('Erro na execução:', err);
  process.exit(1);
});
