export function removeAcentos(texto) {
  if (!texto) return '';
  return texto
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function normalizeCaixa(caixa, loja = '') {
  if (!caixa) return '';
  const str = String(caixa).trim();
  if (!str) return '';

  // 1. Shorthand com B: "5b", "19b", "5B", "caixa 5b", "caixa 19b", "c5b", "c 19b", "caixa5b" -> "Caixa 5B", "Caixa 19B"
  const matchB = str.match(/^(?:caixa|c)?\s*(\d+)\s*b$/i);
  if (matchB) {
    return `Caixa ${matchB[1]}B`;
  }

  // 2. Com prefixo caixa/c mas sem B: "caixa 5", "caixa 19", "c 5", "c5"
  const matchCaixaNum = str.match(/^(?:caixa|c)\s*(\d+)$/i);
  if (matchCaixaNum) {
    const num = matchCaixaNum[1];
    if (loja === 'Loja 1') {
      return num; // No banco Loja 1 armazena número puro
    }
    if (loja === 'Loja 2') {
      return `Caixa ${num}B`;
    }
    return `Caixa ${num}`;
  }

  // 3. Se for Loja 2 e digitar apenas número puro "5", entende como "Caixa 5B"
  if (loja === 'Loja 2') {
    const matchJustNum = str.match(/^(\d+)$/);
    if (matchJustNum) {
      return `Caixa ${matchJustNum[1]}B`;
    }
  }

  return str;
}

export function formatCaixa(caixa, loja) {
  if (!caixa) return '—';
  const str = String(caixa).trim();
  if (!str) return '—';

  // Se for "5b", "19b", "5B", etc.
  const matchB = str.match(/^(\d+)\s*b$/i);
  if (matchB) {
    return `Caixa ${matchB[1]}B`;
  }

  if (str.toLowerCase().startsWith('caixa ')) {
    const matchCaixaB = str.match(/^caixa\s*(\d+)\s*b$/i);
    if (matchCaixaB) {
      return `Caixa ${matchCaixaB[1]}B`;
    }
    return str;
  }

  const isNumeric = !isNaN(Number(str)) && str !== '';
  if (loja === 'Loja 1' && isNumeric) {
    return `Caixa ${str}`;
  }
  return str;
}

export function cleanDiscogsString(texto) {
  if (!texto) return '';
  return texto
    .toString()
    .replace(/\*+$/g, '')
    .replace(/\s*\(\d+\)$/g, '')
    .trim();
}

export const MUSIC_STOP_WORDS = new Set([
  // Artigos e preposições (Inglês)
  'the', 'a', 'an', 'and', 'of',
  // Artigos e preposições (Português)
  'o', 'os', 'as', 'um', 'uma', 'uns', 'umas',
  'de', 'do', 'da', 'dos', 'das', 'e',
  // Espanhol
  'el', 'la', 'los', 'las', 'del', 'y',
  // Francês / Italiano
  'le', 'les', 'des', 'du', 'et',
  // Tags e ruídos musicais
  'feat', 'ft', 'featuring', 'vs', 'part'
]);

/**
 * Extrai tokens inteligentes de pesquisa fonográfica.
 * Remove pontuações ruidosas (como '-', ':', '()') e separa palavras de conteúdo de artigos/stop words.
 */
export function extractSearchTokens(queryStr) {
  if (!queryStr) return { allWords: [], contentWords: [], effectiveWords: [] };

  const clean = removeAcentos(queryStr)
    .replace(/[-–—:()/\_\\*~!?[\]+"',.;&]/g, ' ')
    .trim();

  const allWords = clean.split(/\s+/).filter(Boolean);
  const contentWords = allWords.filter(w => !MUSIC_STOP_WORDS.has(w) && w.length >= 2);

  // Se houver palavras de conteúdo (ex: "jacksons", "victory"), elas guiam a busca.
  // Se a busca for estritamente uma stop word (ex: "The", "Os"), usa allWords.
  const effectiveWords = contentWords.length > 0 ? contentWords : allWords;

  return {
    allWords,
    contentWords,
    effectiveWords
  };
}

/**
 * Calcula a pontuação de relevância de um item para a ordenação dos resultados de busca.
 */
export function calculateItemRelevance(item, allWords = [], effectiveWords = [], isVideo = false) {
  if (!item) return 0;
  let score = 0;

  const itemTitulo = removeAcentos(item.titulo || '');
  const itemArtista = isVideo ? '' : removeAcentos(item.artista || '');
  const itemCaixa = removeAcentos(item.caixa || '');
  const fullText = `${itemArtista} ${itemTitulo} ${itemCaixa}`.trim();

  // 1. Bônus se contiver todas as palavras originais (inclusive "the", "os", etc.)
  if (allWords.length > 0 && allWords.every(w => fullText.includes(w))) {
    score += 100;
  }

  // 2. Pontuação por cada palavra efetiva encontrada
  let matchedEffective = 0;
  effectiveWords.forEach(w => {
    if (fullText.includes(w)) {
      matchedEffective++;
      score += 30;
      if (!isVideo && itemArtista.includes(w)) score += 20;
      if (itemTitulo.includes(w)) score += 20;
    }
  });

  // 3. Bônus se todas as palavras efetivas estão presentes
  if (effectiveWords.length > 0 && matchedEffective === effectiveWords.length) {
    score += 50;
  }

  // 4. Prioridade leve para item Ativo no chão de loja
  if (item.ativo !== false) {
    score += 10;
  }

  return score;
}

