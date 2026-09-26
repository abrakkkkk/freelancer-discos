const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  console.log('=== Iniciando Execução da 6ª Rodada (278 Discos de R$ 200 a R$ 299 - Anos e Ajustes) ===');
  
  const relatorio = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'relatorio_anos_faixa_200_299.json'), 'utf8'));
  console.log(`Total de discos a atualizar: ${relatorio.length}`);

  // Passo 1: Backup
  console.log('\n[Passo 1/4] Fazendo backup do estado atual dos registros...');
  const ids = relatorio.map(r => r.id);
  
  let backup = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { data, error } = await supabase
      .from('discos')
      .select('id, artista, titulo, ano, preco, atualizado_em, caixa, loja')
      .in('id', chunk);
      
    if (error) {
      console.error('Erro no backup:', error);
      process.exit(1);
    }
    backup = backup.concat(data);
  }
  
  const backupPath = path.resolve(__dirname, 'backup_tratamento_dados_rodada_6_pre_update.json');
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf8');
  console.log(`Backup salvo com sucesso (${backup.length} registros) em: ${backupPath}`);

  // Passo 2: Updates
  console.log('\n[Passo 2/4] Executando updates no banco de dados...');
  let sucessoCount = 0;
  let erroCount = 0;
  const erros = [];

  const poolSize = 10;
  for (let i = 0; i < relatorio.length; i += poolSize) {
    const slice = relatorio.slice(i, i + poolSize);
    
    await Promise.all(slice.map(async (item) => {
      const now = new Date().toISOString();
      const updateData = {
        ano: item.anoRecomendado,
        atualizado_em: now
      };

      if (item.artistaRecomendado && item.artistaRecomendado !== item.artistaAtual) {
        updateData.artista = item.artistaRecomendado;
      }
      if (item.tituloRecomendado && item.tituloRecomendado !== item.tituloAtual) {
        updateData.titulo = item.tituloRecomendado;
      }

      const { error } = await supabase
        .from('discos')
        .update(updateData)
        .eq('id', item.id);
        
      if (error) {
        erroCount++;
        erros.push({ id: item.id, error: error.message });
      } else {
        sucessoCount++;
      }
    }));
    
    process.stdout.write(`\rProgresso: ${sucessoCount + erroCount}/${relatorio.length} (Sucessos: ${sucessoCount}, Falhas: ${erroCount})`);
  }
  
  console.log(`\n\n[Passo 3/4] Resultado dos updates:`);
  console.log(`- Sucessos: ${sucessoCount}`);
  console.log(`- Falhas: ${erroCount}`);
  
  if (erros.length > 0) {
    console.error('Erros encontrados:', erros);
  }

  // Passo 3: Cache de Capas
  console.log('\n[Passo 4/4] Limpando/Invalidando cache de capas para discos alterados...');
  const coversPath = path.resolve(__dirname, '../src/data/covers_cache.json');
  if (fs.existsSync(coversPath)) {
    const covers = JSON.parse(fs.readFileSync(coversPath, 'utf8'));
    let coversRemovidas = 0;
    ids.forEach(id => {
      const strId = String(id);
      if (covers[strId]) {
        delete covers[strId];
        coversRemovidas++;
      }
    });
    if (coversRemovidas > 0) {
      fs.writeFileSync(coversPath, JSON.stringify(covers, null, 2), 'utf8');
      console.log(`Foram invalidadas ${coversRemovidas} capas em src/data/covers_cache.json.`);
    } else {
      console.log('Nenhuma capa antiga precisou de invalidação imediata em covers_cache.json.');
    }
  }

  console.log('\n=== 6ª Rodada concluída com sucesso! ===');
}

main().catch(console.error);
