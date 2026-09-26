const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  console.log('Buscando todos os discos do Supabase...');
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('discos')
      .select('id, artista, titulo, categoria, caixa, loja, observacao, ano, preco')
      .eq('deletado', false)
      .order('id', { ascending: true })
      .range(from, from + 999);
    if (error) { console.error(error); break; }
    if (!data || !data.length) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`Total baixado: ${all.length}`);

  // 1. Verificar registros com asterisco (*)
  const comAsterisco = all.filter(d => 
    (d.artista && d.artista.includes('*')) || 
    (d.titulo && d.titulo.includes('*')) || 
    (d.observacao && d.observacao.includes('*'))
  );
  console.log(`Discos contendo '*': ${comAsterisco.length}`);
  comAsterisco.forEach(d => console.log(`  [ID ${d.id}] [${d.loja} C${d.caixa}] Artista: "${d.artista}" | Titulo: "${d.titulo}" | Obs: "${d.observacao}"`));

  // 2. Verificar o que significa "os que estão sem *"
  // Poderia ser: "os que estão sem artista"? (sem [algo])
  const semArtista = all.filter(d => !d.artista || d.artista.trim() === '' || d.artista.trim() === '-');
  console.log(`\nDiscos sem artista: ${semArtista.length}`);

  // 3. Verificar registros em minúsculo (artista ou título)
  // Ignorando palavras que são minúsculas por padrão: de, da, do, dos, das, e, em, para, com, um, uma, por, no, na, the, of, in, on, at, to, a, an, and, &
  const palavrasMinusculasPadrao = new Set([
    'de', 'da', 'do', 'dos', 'das', 'e', 'em', 'para', 'com', 'um', 'uma', 'por', 'no', 'na', 'nos', 'nas',
    'the', 'of', 'in', 'on', 'at', 'to', 'a', 'an', 'and', '&', 'o', 'as', 'os'
  ]);

  // Artista que está totalmente em minúsculo (ex: "elvis", "maria bethania") ou começa com minúscula
  const artistaMinusculo = all.filter(d => {
    if (!d.artista || !d.artista.trim()) return false;
    const trimmed = d.artista.trim();
    // Primeira letra é minúscula e é letra
    const firstChar = trimmed[0];
    return firstChar === firstChar.toLowerCase() && /[a-zà-ÿ]/.test(firstChar);
  });

  // Título que começa com minúscula (que não seja palavra que deveria ser capitalizada no início do título)
  // Notar que mesmo artigos como "the", "o", "a", no início de um título devem ser maiúsculos ("The", "O", "A")!
  const tituloComecaMinusculo = all.filter(d => {
    if (!d.titulo || !d.titulo.trim()) return false;
    const trimmed = d.titulo.trim();
    const firstChar = trimmed[0];
    return firstChar === firstChar.toLowerCase() && /[a-zà-ÿ]/.test(firstChar);
  });

  // Artistas com palavras principais em minúsculo no meio (ex: "Altemar dutra", "The beatles", "kid abelha")
  const artistaPalavrasMinusculas = all.filter(d => {
    if (!d.artista || !d.artista.trim()) return false;
    const palavras = d.artista.trim().split(/\s+/);
    // Verificar se alguma palavra NÃO padrão está em minúsculo
    return palavras.some((p, idx) => {
      const pNorm = p.toLowerCase().replace(/[^a-zà-ÿ]/g, '');
      if (!pNorm || palavrasMinusculasPadrao.has(pNorm)) return false;
      // Se não for palavra padrão, deveria começar com maiúscula
      return p[0] === p[0].toLowerCase() && /[a-zà-ÿ]/.test(p[0]);
    });
  });

  console.log(`\nArtistas que começam com minúscula: ${artistaMinusculo.length}`);
  console.log(`Artistas com palavras próprias em minúsculo: ${artistaPalavrasMinusculas.length}`);
  console.log(`Títulos que começam com minúscula: ${tituloComecaMinusculo.length}`);

  console.log('\nExemplos de Artistas com minúscula:');
  artistaPalavrasMinusculas.slice(0, 20).forEach(d => console.log(`  [ID ${d.id}] [${d.loja} C${d.caixa}] Artista: "${d.artista}" | Titulo: "${d.titulo}"`));

  console.log('\nExemplos de Títulos começando com minúscula:');
  tituloComecaMinusculo.slice(0, 20).forEach(d => console.log(`  [ID ${d.id}] [${d.loja} C${d.caixa}] Artista: "${d.artista}" | Titulo: "${d.titulo}"`));

  fs.writeFileSync('./scripts/temp_all_fresh.json', JSON.stringify(all, null, 2), 'utf8');
}

check();
