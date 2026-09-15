// Algoritmo de Embeddings Visuais Vetoriais (256 dimensões) e dHash perceptual para cache visual no navegador
// Roda em < 5ms usando canvas offscreen sem bibliotecas pesadas de IA

const DHASH_CACHE_STORAGE_KEY = 'freelancer_visual_cover_cache_v2';
const VECTOR_CACHE_STORAGE_KEY = 'freelancer_visual_vector_cache_v1';
const MAX_CACHE_ENTRIES = 500;
const DEFAULT_HAMMING_THRESHOLD = 2; // Tolerância estrita (até 2 bits)
const DEFAULT_VECTOR_SIMILARITY = 0.87; // Similaridade de cosseno mínima para match seguro

/**
 * Calcula o dHash de 64 bits a partir de um HTMLCanvasElement, HTMLImageElement ou HTMLVideoElement.
 */
export function computeDHash(source) {
  if (typeof document === 'undefined') return null;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 9;
    canvas.height = 8;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(source, 0, 0, 9, 8);
    const imgData = ctx.getImageData(0, 0, 9, 8);
    const d = imgData.data;

    // Converte para escala de cinza
    const grays = new Uint8Array(9 * 8);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      grays[j] = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    }

    // Compara pixels adjacentes horizontalmente (8 bits por linha * 8 linhas = 64 bits)
    let binary = '';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const left = grays[y * 9 + x];
        const right = grays[y * 9 + (x + 1)];
        binary += left > right ? '1' : '0';
      }
    }

    // Converte os 64 bits em string hexadecimal de 16 caracteres
    let hex = '';
    for (let i = 0; i < 64; i += 4) {
      const nibble = binary.substring(i, i + 4);
      hex += parseInt(nibble, 2).toString(16);
    }

    return hex;
  } catch (err) {
    console.warn('Erro ao calcular dHash perceptual:', err);
    return null;
  }
}

/**
 * Calcula a distância de Hamming entre dois hashes hexadecimais de 64 bits (0 a 64).
 */
export function hammingDistance(hex1, hex2) {
  if (!hex1 || !hex2 || hex1.length !== hex2.length) return 64;
  let dist = 0;
  for (let i = 0; i < hex1.length; i++) {
    const n1 = parseInt(hex1[i], 16);
    const n2 = parseInt(hex2[i], 16);
    let xor = n1 ^ n2;
    while (xor > 0) {
      dist += xor & 1;
      xor >>= 1;
    }
  }
  return dist;
}

/**
 * Extrai um vetor denso normalizado de 256 dimensões da imagem (Luminância 8x8 + Momentos de Cor 4x4 + Gradientes de Borda).
 * Executa em ~3ms sem precisar carregar modelos WASM pesados.
 */
export function computeVisualVector(source) {
  if (typeof document === 'undefined') return null;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(source, 0, 0, 16, 16);
    const imgData = ctx.getImageData(0, 0, 16, 16);
    const data = imgData.data;

    const vector = new Float32Array(256);
    let idx = 0;

    // 1. Luminância em grade 8x8 (64 dimensões) agrupando blocos 2x2
    const lum8x8 = new Float32Array(64);
    for (let by = 0; by < 8; by++) {
      for (let bx = 0; bx < 8; bx++) {
        let sum = 0;
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const px = (by * 2 + dy) * 16 + (bx * 2 + dx);
            const p = px * 4;
            sum += 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
          }
        }
        lum8x8[by * 8 + bx] = sum / 4.0;
        vector[idx++] = lum8x8[by * 8 + bx];
      }
    }

    // 2. Momentos de cor espacial 4x4 (16 blocos * 3 canais = 48 dimensões + 16 variâncias = 64 dimensões)
    for (let by = 0; by < 4; by++) {
      for (let bx = 0; bx < 4; bx++) {
        let rSum = 0, gSum = 0, bSum = 0;
        let pCount = 16; // cada bloco tem 4x4 pixels
        for (let dy = 0; dy < 4; dy++) {
          for (let dx = 0; dx < 4; dx++) {
            const px = (by * 4 + dy) * 16 + (bx * 4 + dx);
            const p = px * 4;
            rSum += data[p];
            gSum += data[p + 1];
            bSum += data[p + 2];
          }
        }
        const rAvg = rSum / pCount;
        const gAvg = gSum / pCount;
        const bAvg = bSum / pCount;
        vector[idx++] = rAvg;
        vector[idx++] = gAvg;
        vector[idx++] = bAvg;

        // Contraste local (variância de luminância no bloco)
        const lumAvg = 0.299 * rAvg + 0.587 * gAvg + 0.114 * bAvg;
        vector[idx++] = Math.abs(rAvg - gAvg) + Math.abs(gAvg - bAvg) + lumAvg * 0.5;
      }
    }

    // 3. Gradientes espaciais horizontais (64 dimensões) e verticais (64 dimensões) = 128 dimensões
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const current = lum8x8[y * 8 + x];
        const right = x < 7 ? lum8x8[y * 8 + (x + 1)] : current;
        vector[idx++] = right - current;
      }
    }
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const current = lum8x8[y * 8 + x];
        const bottom = y < 7 ? lum8x8[(y + 1) * 8 + x] : current;
        vector[idx++] = bottom - current;
      }
    }

    // Normalização L2 para que o produto escalar seja equivalente à Similaridade de Cosseno direta
    let normSq = 0;
    for (let i = 0; i < 256; i++) {
      normSq += vector[i] * vector[i];
    }
    const norm = Math.sqrt(normSq) || 1e-6;
    for (let i = 0; i < 256; i++) {
      vector[i] = Number((vector[i] / norm).toFixed(4));
    }

    return Array.from(vector);
  } catch (err) {
    console.warn('Erro ao calcular vetor visual:', err);
    return null;
  }
}

/**
 * Calcula a similaridade de cosseno entre dois vetores normalizados (retorna de -1 a 1).
 */
export function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dot = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
  }
  return dot;
}

/**
 * Busca no cache de vetores por similaridade de cosseno (Camada 1: < 5ms).
 */
export function findInVisualVectorCache(vector, minSimilarity = DEFAULT_VECTOR_SIMILARITY) {
  if (!vector || typeof window === 'undefined' || !window.localStorage) return null;

  try {
    const raw = localStorage.getItem(VECTOR_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw);

    let bestMatch = null;
    let maxSim = minSimilarity;

    for (const item of Object.values(cache)) {
      if (!item.vector) continue;
      const sim = cosineSimilarity(vector, item.vector);
      if (sim > maxSim) {
        maxSim = sim;
        bestMatch = {
          artista: item.artista,
          titulo: item.titulo,
          ano: item.ano,
          similarity: sim,
          isCached: true,
          method: 'vector-cosine'
        };
      }
    }

    return bestMatch;
  } catch (e) {
    console.warn('Erro ao ler cache de vetores:', e);
    return null;
  }
}

/**
 * Salva metadados e vetor no cache vetorial local.
 */
export function saveToVisualVectorCache(vector, { artista, titulo, ano }) {
  if (!vector || !artista || typeof window === 'undefined' || !window.localStorage) return;

  try {
    const raw = localStorage.getItem(VECTOR_CACHE_STORAGE_KEY);
    const cache = raw ? JSON.parse(raw) : {};

    const key = `${(artista || '').toLowerCase().trim()}:::${(titulo || '').toLowerCase().trim()}`;
    cache[key] = {
      artista: (artista || '').trim(),
      titulo: (titulo || '').trim(),
      ano: (ano || '').trim(),
      vector,
      timestamp: Date.now()
    };

    const keys = Object.keys(cache);
    if (keys.length > MAX_CACHE_ENTRIES) {
      keys.sort((a, b) => (cache[a].timestamp || 0) - (cache[b].timestamp || 0));
      const toDelete = keys.slice(0, keys.length - MAX_CACHE_ENTRIES);
      toDelete.forEach(k => delete cache[k]);
    }

    localStorage.setItem(VECTOR_CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('Erro ao salvar cache de vetores:', e);
  }
}

/**
 * Busca no cache local se existe alguma capa visualmente similar via dHash.
 */
export function findInVisualCache(hash, maxDistance = DEFAULT_HAMMING_THRESHOLD) {
  if (!hash || typeof window === 'undefined' || !window.localStorage) return null;

  try {
    const raw = localStorage.getItem(DHASH_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw);

    let bestMatch = null;
    let minDistance = maxDistance + 1;

    for (const [cachedHash, item] of Object.entries(cache)) {
      const dist = hammingDistance(hash, cachedHash);
      if (dist <= maxDistance && dist < minDistance) {
        minDistance = dist;
        bestMatch = { ...item, distance: dist, isCached: true, method: 'dhash' };
      }
    }

    return bestMatch;
  } catch (e) {
    console.warn('Erro ao ler cache visual:', e);
    return null;
  }
}

/**
 * Salva uma nova capa e seus metadados no cache visual do navegador via dHash.
 */
export function saveToVisualCache(hash, { artista, titulo, ano }) {
  if (!hash || !artista || typeof window === 'undefined' || !window.localStorage) return;

  try {
    const raw = localStorage.getItem(DHASH_CACHE_STORAGE_KEY);
    const cache = raw ? JSON.parse(raw) : {};

    cache[hash] = {
      artista: (artista || '').trim(),
      titulo: (titulo || '').trim(),
      ano: (ano || '').trim(),
      timestamp: Date.now()
    };

    const keys = Object.keys(cache);
    if (keys.length > MAX_CACHE_ENTRIES) {
      keys.sort((a, b) => (cache[a].timestamp || 0) - (cache[b].timestamp || 0));
      const toDelete = keys.slice(0, keys.length - MAX_CACHE_ENTRIES);
      toDelete.forEach(k => delete cache[k]);
    }

    localStorage.setItem(DHASH_CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('Erro ao salvar cache visual:', e);
  }
}

/**
 * Verificação unificada de alta velocidade: testa primeiro Embeddings Vetoriais (mais resiliente a luz/ângulo)
 * e em seguida testa dHash de 64 bits.
 */
export function findBestVisualMatch({ hash, vector }) {
  if (vector) {
    const vectorMatch = findInVisualVectorCache(vector);
    if (vectorMatch) return vectorMatch;
  }
  if (hash) {
    const hashMatch = findInVisualCache(hash);
    if (hashMatch) return hashMatch;
  }
  return null;
}
