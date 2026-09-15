import { removeAcentos } from './stringUtils.js';

/**
 * Normaliza string para comparação fonográfica rápida: sem acentos, minúscula e sem pontuação.
 */
export function normalizeToken(str) {
  if (!str) return '';
  return removeAcentos(String(str).toLowerCase())
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calcula a distância Levenshtein simples entre duas strings para tolerar pequenos erros de OCR.
 */
export function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substituição
          matrix[i][j - 1] + 1,     // inserção
          matrix[i - 1][j] + 1      // deleção
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Calcula similaridade baseada em interseção de palavras (Token Set Jaccard), robusto a palavras fora de ordem.
 */
export function tokenSetSimilarity(str1, str2) {
  const t1 = new Set(normalizeToken(str1).split(' ').filter(w => w.length >= 2));
  const t2 = new Set(normalizeToken(str2).split(' ').filter(w => w.length >= 2));
  if (t1.size === 0 || t2.size === 0) return 0;
  let intersection = 0;
  for (const w of t1) {
    if (t2.has(w)) intersection++;
  }
  return intersection / Math.min(t1.size, t2.size);
}

/**
 * Calcula similaridade fuzzy (0.0 a 1.0) entre duas strings.
 */
export function fuzzySimilarity(str1, str2) {
  const s1 = normalizeToken(str1);
  const s2 = normalizeToken(str2);
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.92;

  const maxLen = Math.max(s1.length, s2.length);
  const dist = levenshteinDistance(s1, s2);
  return 1.0 - dist / maxLen;
}

/**
 * Busca rápida no estoque local (sessionStorage / cache) por um álbum a partir de texto detectado.
 * Retorna o item se encontrar match com confiança >= 0.85 em < 15ms.
 */
export function matchLocalStock(textQuery, stockList = []) {
  if (!textQuery || !Array.isArray(stockList) || stockList.length === 0) return null;

  const normQuery = normalizeToken(textQuery);
  if (normQuery.length < 3) return null;

  let bestMatch = null;
  let maxScore = 0.82; // corte mínimo de confiança

  for (const item of stockList) {
    if (!item.artista && !item.titulo) continue;

    const normArtista = normalizeToken(item.artista);
    const normTitulo = normalizeToken(item.titulo);
    const normFull = `${normArtista} ${normTitulo}`.trim();

    // 1. Coincidência direta de substrings
    if (normArtista && normQuery.includes(normArtista) && normTitulo && normQuery.includes(normTitulo)) {
      return {
        artista: item.artista,
        titulo: item.titulo,
        ano: item.ano || '',
        confianca: 'alta',
        method: 'local-stock-exact',
        origemItem: item
      };
    }

    // 2. Similaridade de Tokens e Fuzzy
    const tokenScore = tokenSetSimilarity(normQuery, normFull);
    const scoreFull = fuzzySimilarity(normQuery, normFull);
    const scoreTitle = normTitulo ? fuzzySimilarity(normQuery, normTitulo) : 0;
    const currentScore = Math.max(tokenScore, scoreFull, scoreTitle);

    if (currentScore > maxScore) {
      maxScore = currentScore;
      bestMatch = {
        artista: item.artista,
        titulo: item.titulo,
        ano: item.ano || '',
        confianca: currentScore > 0.88 ? 'alta' : 'media',
        score: currentScore,
        method: tokenScore >= 0.80 ? 'local-stock-tokens' : 'local-stock-fuzzy',
        origemItem: item
      };
    }
  }

  return bestMatch;
}
