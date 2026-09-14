import { execSync } from 'child_process';
import * as XLSX from 'xlsx';
import fs from 'fs';
import { supabase } from '../src/lib/supabase.js';

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

async function main() {
  console.log('--- RESTAURAÇÃO DE PREÇOS DA CAIXA 45 ---');

  // 1. Extrair planilha do commit histórico do git
  console.log('1. Extraindo dados originais da planilha histórica...');
  const buf = execSync('git show 4ec156bc7b19069041159dc2697e0bcc684ce789:"Estoque de Discos 2026 (1).xlsx"', {
    maxBuffer: 50 * 1024 * 1024,
    encoding: 'buffer'
  });
  const workbook = XLSX.read(buf, { type: 'buffer' });
  const sheet = workbook.Sheets["Banheiro Esquerdo I (45)"];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const sheetItems = [];
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[1] || String(r[1]).trim() === '') continue;
    const produto = String(r[1]).trim();
    const preco = Number(r[2]);
    sheetItems.push({
      sheetRow: i,
      produto,
      preco: isNaN(preco) ? null : preco,
      norm: normalize(produto),
      used: false
    });
  }
  console.log(`Itens extraídos da aba Caixa 45: ${sheetItems.length}`);

  // 2. Buscar itens da Caixa 45 com preço nulo no Supabase
  console.log('2. Buscando registros no Supabase para Caixa 45 com preco = null...');
  const { data: dbBatch, error: fetchErr } = await supabase
    .from('discos')
    .select('id, artista, titulo, preco, deletado, ativo, caixa, loja')
    .eq('caixa', '45')
    .is('preco', null)
    .order('id', { ascending: true });

  if (fetchErr) {
    console.error('Erro ao buscar dados:', fetchErr);
    process.exit(1);
  }

  console.log(`Discos encontrados para restaurar: ${dbBatch.length}`);

  // 3. Salvar backup de segurança
  const backupFile = 'scripts/backup_precos_caixa45.json';
  fs.writeFileSync(backupFile, JSON.stringify(dbBatch, null, 2), 'utf-8');
  console.log(`Backup de segurança salvo em ${backupFile}`);

  // 4. Mapeamento 1-para-1 com os preços da planilha
  const updates = [];
  let lastSheetIndex = 0;

  for (const db of dbBatch) {
    const artNorm = normalize(db.artista);
    const titNorm = normalize(db.titulo);
    const combNorm = normalize(`${db.artista} ${db.titulo}`);
    const revCombNorm = normalize(`${db.titulo} ${db.artista}`);

    let bestIdx = -1;
    let bestScore = -1;

    for (let j = 0; j < sheetItems.length; j++) {
      if (sheetItems[j].used) continue;
      const s = sheetItems[j];

      let score = 0;
      if (s.norm === combNorm || s.norm === revCombNorm) {
        score = 100;
      } else if (titNorm && s.norm.includes(titNorm) && artNorm && s.norm.includes(artNorm)) {
        score = 95;
      } else if (titNorm && (titNorm === 'pim' && s.norm.includes('pim'))) {
        score = 90;
      } else if (titNorm.length >= 4 && s.norm.includes(titNorm)) {
        score = 80;
      } else if (artNorm.length >= 4 && s.norm.includes(artNorm)) {
        score = 70;
      } else if (combNorm.length >= 5 && (s.norm.includes(combNorm) || combNorm.includes(s.norm))) {
        score = 85;
      }

      const dist = Math.abs(j - lastSheetIndex);
      if (dist < 10) {
        score += (10 - dist);
      }

      if (score > bestScore) {
        bestScore = score;
        bestIdx = j;
      }
    }

    if (bestIdx !== -1 && bestScore >= 50 && sheetItems[bestIdx].preco !== null) {
      sheetItems[bestIdx].used = true;
      lastSheetIndex = bestIdx;
      updates.push({
        id: db.id,
        artista: db.artista,
        titulo: db.titulo,
        preco: sheetItems[bestIdx].preco,
        sheetProduto: sheetItems[bestIdx].produto,
        sheetRow: sheetItems[bestIdx].sheetRow,
        ativo: db.ativo,
        deletado: db.deletado
      });
    } else {
      console.warn(`[AVISO] Não foi possível encontrar preço para ID ${db.id}: "${db.artista}" - "${db.titulo}"`);
    }
  }

  console.log(`\nTotal de itens mapeados com sucesso: ${updates.length} de ${dbBatch.length}`);

  // 5. Aplicar atualizações em lote no Supabase
  console.log('5. Aplicando atualizações no Supabase...');
  let updatedCount = 0;
  let errorCount = 0;

  for (const item of updates) {
    const { error: updateErr } = await supabase
      .from('discos')
      .update({ preco: item.preco })
      .eq('id', item.id);

    if (updateErr) {
      console.error(`Erro ao atualizar ID ${item.id}:`, updateErr);
      errorCount++;
    } else {
      updatedCount++;
      if (updatedCount % 25 === 0 || updatedCount === updates.length) {
        console.log(`Progresso: ${updatedCount}/${updates.length} discos atualizados...`);
      }
    }
  }

  console.log(`\nAtualização concluída: ${updatedCount} sucesso, ${errorCount} erros.`);

  // 6. Verificação pós-atualização
  console.log('\n6. Verificando estado final da Caixa 45 no banco...');
  const { data: checkData } = await supabase
    .from('discos')
    .select('id, preco, deletado, ativo')
    .eq('caixa', '45');

  const stillNull = checkData.filter(d => d.preco === null || d.preco === undefined);
  const activeWithPrice = checkData.filter(d => d.ativo && !d.deletado && d.preco > 0);
  const activeWithoutPrice = checkData.filter(d => d.ativo && !d.deletado && (!d.preco || d.preco <= 0));

  console.log(`Total de discos na Caixa 45: ${checkData.length}`);
  console.log(`Discos ativos COM preço: ${activeWithPrice.length}`);
  console.log(`Discos ativos SEM preço: ${activeWithoutPrice.length}`);
  console.log(`Discos com preço nulo em toda a Caixa 45: ${stillNull.length}`);
}

main().catch(console.error);
