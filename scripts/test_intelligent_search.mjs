import assert from 'node:assert';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { extractSearchTokens, calculateItemRelevance, removeAcentos } from '../src/utils/stringUtils.js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Simulação fiel de fetchItems com a nova lógica implementada
async function fetchItemsTest(category, { busca = '', loja = '', activeTab = 'discos' } = {}) {
  const isVideo = category === 'dvds' || category === 'vhs';
  let columns = 'id, titulo, preco, ativo, loja, observacao, caixa, ano';
  if (!isVideo) columns += ', artista';

  let query = supabase.from(category).select(columns, { count: 'exact' }).eq('deletado', false);
  if (loja) query = query.eq('loja', loja);

  let searchTokens = null;
  if (busca) {
    searchTokens = extractSearchTokens(busca);
    const { effectiveWords } = searchTokens;

    effectiveWords.forEach(word => {
      const wildcardWord = word.replace(/[aeiou]/g, '_');
      if (isVideo) {
        query = query.ilike('titulo', `%${wildcardWord}%`);
      } else {
        query = query.or(`titulo.ilike.%${wildcardWord}%,artista.ilike.%${wildcardWord}%,caixa.ilike.%${wildcardWord}%`);
      }
    });
    query = query.limit(5000);
  }

  const { data, error } = await query;
  if (error) throw error;

  let filteredData = data || [];

  if (busca && searchTokens) {
    const { allWords, effectiveWords } = searchTokens;
    filteredData = filteredData.filter(item => {
      const itemTitulo = removeAcentos(item.titulo || '');
      const itemArtista = removeAcentos(item.artista || '');
      const itemCaixa = removeAcentos(item.caixa || '');
      const itemCaixaSemEspaco = itemCaixa.replace(/\s+/g, '');

      return effectiveWords.every(word => {
        const wordSemEspaco = word.replace(/\s+/g, '');
        if (isVideo) {
          return itemTitulo.includes(word);
        } else {
          return itemTitulo.includes(word) ||
                 itemArtista.includes(word) ||
                 itemCaixa.includes(word) ||
                 (wordSemEspaco && itemCaixaSemEspaco.includes(wordSemEspaco));
        }
      });
    });

    filteredData.sort((a, b) => {
      const scoreA = calculateItemRelevance(a, allWords, effectiveWords, isVideo);
      const scoreB = calculateItemRelevance(b, allWords, effectiveWords, isVideo);
      return scoreB - scoreA;
    });
  }

  return filteredData;
}

async function runTests() {
  console.log('--- Teste 1: extractSearchTokens ---');
  
  const t1 = extractSearchTokens('The Jacksons - Victory');
  assert.deepStrictEqual(t1.effectiveWords, ['jacksons', 'victory']);
  
  const t2 = extractSearchTokens('The Jacksons Victory');
  assert.deepStrictEqual(t2.effectiveWords, ['jacksons', 'victory']);
  
  const t3 = extractSearchTokens('Jacksons - Victory');
  assert.deepStrictEqual(t3.effectiveWords, ['jacksons', 'victory']);

  const t4 = extractSearchTokens('The Beatles');
  assert.deepStrictEqual(t4.effectiveWords, ['beatles']);

  const t5 = extractSearchTokens('Os Mutantes - A Divina Comedia');
  assert.deepStrictEqual(t5.effectiveWords, ['mutantes', 'divina', 'comedia']);

  const t6 = extractSearchTokens('The');
  assert.deepStrictEqual(t6.effectiveWords, ['the']);

  console.log('✓ extractSearchTokens passou em todos os casos unitários!');

  console.log('\n--- Teste 2: Busca Real no Supabase com "The Jacksons - Victory" ---');
  
  const res1 = await fetchItemsTest('discos', { busca: 'The Jacksons - Victory' });
  console.log(`Resultados para "The Jacksons - Victory": ${res1.length} discos encontrados.`);
  res1.forEach(d => console.log(`  - [ID ${d.id}] Artista: "${d.artista}" | Título: "${d.titulo}" | Loja: "${d.loja}" | Caixa: "${d.caixa}"`));
  assert.strictEqual(res1.length, 4, 'Deveria retornar exatamente os 4 discos Victory cadastrados!');

  console.log('\n--- Teste 3: Busca Real no Supabase com "The Jacksons Victory" (saída da câmera) ---');
  const res2 = await fetchItemsTest('discos', { busca: 'The Jacksons Victory' });
  console.log(`Resultados para "The Jacksons Victory": ${res2.length} discos encontrados.`);
  assert.strictEqual(res2.length, 4);

  console.log('\n--- Teste 4: Busca Real no Supabase com "Jacksons - Victory" ---');
  const res3 = await fetchItemsTest('discos', { busca: 'Jacksons - Victory' });
  console.log(`Resultados para "Jacksons - Victory": ${res3.length} discos encontrados.`);
  assert.strictEqual(res3.length, 4);

  console.log('\n--- Teste 5: Relevância e Ranking ---');
  // Verifica se o cálculo de relevância ranqueia com precisão
  const topItem = res1[0];
  const scoreTop = calculateItemRelevance(topItem, ['the', 'jacksons', 'victory'], ['jacksons', 'victory']);
  console.log(`Item Top [ID ${topItem.id}] Artista: "${topItem.artista}" - Score: ${scoreTop}`);
  assert(scoreTop > 50, 'Score de relevância deve ser alto para correspondência completa');

  console.log('\n✓ TODOS OS TESTES FORAM APROVADOS COM SUCESSO TOTAL!');
}

runTests().catch(err => {
  console.error('Falha nos testes:', err);
  process.exit(1);
});
