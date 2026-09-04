const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, supabaseKey);

const isDryRun = process.argv.includes('--dry-run');

function processarDisco(disco) {
  let { id, artista, titulo, ano, loja, caixa } = disco;
  let novoArtista = artista ? artista.trim() : '';
  let novoTitulo = titulo ? titulo.trim() : '';
  let anoExtraido = null;
  let alterou = false;

  // 1. Título termina com (YYYY) em parênteses
  // Ex: "Fagner (1982)", "Pepeu Gomes (1988)"
  const matchParenteses = novoTitulo.match(/\s*\((19\d{2}|20\d{2})\)\s*$/);
  if (matchParenteses) {
    anoExtraido = matchParenteses[1];
    novoTitulo = novoTitulo.replace(/\s*\((19\d{2}|20\d{2})\)\s*$/, '').trim();
    alterou = true;
  }

  // 2. Título termina com " - YYYY" ou " – YYYY"
  // Ex: "Face Ácida – 1994"
  if (!anoExtraido) {
    const matchTraco = novoTitulo.match(/\s+[-–—]\s*(19\d{2}|20\d{2})\s*$/);
    if (matchTraco) {
      anoExtraido = matchTraco[1];
      novoTitulo = novoTitulo.replace(/\s+[-–—]\s*(19\d{2}|20\d{2})\s*$/, '').trim();
      alterou = true;
    }
  }

  // 3. Artista termina com ano YYYY
  // Ex: "Nara Leão 1968", "Taylor Swift 2006"
  const matchArtistaAno = novoArtista.match(/\s+(19\d{2}|20\d{2})\s*$/);
  if (matchArtistaAno) {
    const anoDoArtista = matchArtistaAno[1];
    if (!anoExtraido) anoExtraido = anoDoArtista;
    novoArtista = novoArtista.replace(/\s+(19\d{2}|20\d{2})\s*$/, '').trim();
    alterou = true;

    // Se o título for idêntico ao artista original, limpa o título também
    if (novoTitulo.toLowerCase() === artista.trim().toLowerCase()) {
      novoTitulo = novoArtista;
    }
  }

  // 4. Título termina com ano solto YYYY (sem parênteses)
  // Ex: "Doris 1972", "Gilson de Souza 1977"
  if (!anoExtraido) {
    const matchAnoSolto = novoTitulo.match(/\s+(19\d{2}|20\d{2})\s*$/);
    if (matchAnoSolto) {
      const candidatoAno = matchAnoSolto[1];
      const tituloSemAno = novoTitulo.replace(/\s+(19\d{2}|20\d{2})\s*$/, '').trim();

      // Regras de segurança para não quebrar títulos:
      // - O título restante não pode ser vazio
      // - Não pode terminar com preposições ("in", "de", "em", "vol", "ao vivo em", "recorded in")
      // - O título original não pode ser um intervalo tipo "1967-1970"
      const terminaComPreposicao = /\b(in|de|em|da|do|vol|volume|ao vivo em|recorded in|live in)\s*$/i.test(tituloSemAno);
      const eIntervalo = /^\d{4}\s*[-–—]\s*\d{4}$/.test(novoTitulo);

      if (!eIntervalo) {
        anoExtraido = candidatoAno;
        if (!terminaComPreposicao && tituloSemAno.length >= 2) {
          novoTitulo = tituloSemAno;
          alterou = true;
        } else {
          // Apenas extrai o ano sem mexer no título para preservar frases completas
          alterou = true;
        }
      }
    }
  }

  // Se já tinha ano no banco e era diferente, preservamos ou atualizamos se estava vazio
  const anoFinal = ano || anoExtraido;
  if (anoFinal && anoFinal !== ano) {
    alterou = true;
  }

  if (!alterou) return null;

  return {
    id,
    loja,
    caixa,
    anterior: {
      artista,
      titulo,
      ano,
    },
    novo: {
      artista: novoArtista,
      titulo: novoTitulo,
      ano: anoFinal,
    },
  };
}

async function executarExtracao() {
  console.log(`=== Extração de Anos dos Nomes (Modo: ${isDryRun ? 'DRY-RUN / TESTE' : 'ATUALIZAÇÃO REAL'}) ===\n`);

  // 1. Buscar todos os discos
  let all = [];
  let from = 0;
  const step = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('discos')
      .select('id, artista, titulo, ano, loja, caixa')
      .range(from, from + step - 1);

    if (error) {
      console.error('Erro ao buscar do Supabase:', error.message);
      process.exit(1);
    }
    if (!data || !data.length) break;
    all = all.concat(data);
    if (data.length < step) break;
    from += step;
  }

  console.log(`Total de discos carregados: ${all.length}`);

  const alteracoes = [];
  for (const d of all) {
    const mudanca = processarDisco(d);
    if (mudanca) {
      alteracoes.push(mudanca);
    }
  }

  console.log(`Discos com alterações identificadas: ${alteracoes.length}\n`);

  console.log('--- Exemplos de alterações propostas (primeiros 15): ---');
  alteracoes.slice(0, 15).forEach((m) => {
    console.log(`ID ${m.id} [${m.loja || 'Sem loja'}]:`);
    if (m.anterior.artista !== m.novo.artista) {
      console.log(`  Artista: "${m.anterior.artista}" -> "${m.novo.artista}"`);
    }
    if (m.anterior.titulo !== m.novo.titulo) {
      console.log(`  Título:  "${m.anterior.titulo}" -> "${m.novo.titulo}"`);
    }
    if (m.anterior.ano !== m.novo.ano) {
      console.log(`  Ano:     ${m.anterior.ano || 'null'} -> "${m.novo.ano}"`);
    }
  });

  if (isDryRun) {
    console.log('\n[Dry-run] Nenhuma alteração foi gravada no banco.');
    return;
  }

  console.log('\nIniciando gravação no Supabase...');
  const chunkSize = 25;
  let gravados = 0;

  for (let i = 0; i < alteracoes.length; i += chunkSize) {
    const chunk = alteracoes.slice(i, i + chunkSize);

    for (const item of chunk) {
      const { error: updErr } = await supabase
        .from('discos')
        .update({
          artista: item.novo.artista,
          titulo: item.novo.titulo,
          ano: item.novo.ano,
        })
        .eq('id', item.id);

      if (updErr) {
        console.error(`Erro ao atualizar ID ${item.id}:`, updErr.message);
      } else {
        gravados++;
      }
    }
    process.stdout.write(`\rProgresso da atualização: ${gravados}/${alteracoes.length}`);
  }

  console.log('\n\nAtualização concluída com sucesso!');
  const logPath = path.resolve(__dirname, 'extracao_ano_nomes_log.json');
  fs.writeFileSync(logPath, JSON.stringify(alteracoes, null, 2), 'utf-8');
  console.log(`Log de auditoria e backup salvo em: ${logPath}`);
}

executarExtracao();
