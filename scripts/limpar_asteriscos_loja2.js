const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');

// Usamos a chave anon ou service_role se disponível
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, supabaseKey);

function limparTexto(texto) {
  if (!texto) return texto;
  return texto.replace(/\*/g, '').replace(/\s{2,}/g, ' ').trim();
}

async function executarLimpezaLoja2() {
  console.log('=== Iniciando Limpeza de Asteriscos - Loja 2 ===\n');

  // 1. Buscar todos os itens da Loja 2
  let allLoja2 = [];
  let from = 0;
  const step = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('discos')
      .select('id, artista, titulo, loja, caixa')
      .eq('loja', 'Loja 2')
      .range(from, from + step - 1);

    if (error) {
      console.error('Erro ao buscar dados do Supabase:', error);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    allLoja2 = allLoja2.concat(data);
    if (data.length < step) break;
    from += step;
  }

  const itensParaLimpar = allLoja2.filter(
    (d) => (d.artista && d.artista.includes('*')) || (d.titulo && d.titulo.includes('*'))
  );

  console.log(`Encontrados ${itensParaLimpar.length} discos na Loja 2 para remoção de asterisco.\n`);

  if (itensParaLimpar.length === 0) {
    console.log('Nenhum disco com asterisco encontrado na Loja 2. Nada a fazer.');
    return;
  }

  const logAtualizacoes = [];

  for (const item of itensParaLimpar) {
    const novoArtista = limparTexto(item.artista);
    const novoTitulo = limparTexto(item.titulo);

    console.log(`Atualizando ID ${item.id}:`);
    if (item.artista !== novoArtista) {
      console.log(`  [Artista] "${item.artista}" -> "${novoArtista}"`);
    }
    if (item.titulo !== novoTitulo) {
      console.log(`  [Título]  "${item.titulo}" -> "${novoTitulo}"`);
    }

    const { error: updateError } = await supabase
      .from('discos')
      .update({
        artista: novoArtista,
        titulo: novoTitulo,
      })
      .eq('id', item.id);

    if (updateError) {
      console.error(`  ERRO ao atualizar ID ${item.id}:`, updateError.message);
    } else {
      console.log(`  -> Sucesso.`);
      logAtualizacoes.push({
        id: item.id,
        loja: item.loja,
        caixa: item.caixa,
        anterior: {
          artista: item.artista,
          titulo: item.titulo,
        },
        novo: {
          artista: novoArtista,
          titulo: novoTitulo,
        },
      });
    }
  }

  const logPath = path.resolve(__dirname, 'limpeza_log.json');
  fs.writeFileSync(logPath, JSON.stringify(logAtualizacoes, null, 2), 'utf-8');
  console.log(`\nLimpeza concluída! ${logAtualizacoes.length} discos atualizados com sucesso.`);
  console.log(`Log de auditoria e backup salvo em: ${logPath}`);
}

executarLimpezaLoja2();
