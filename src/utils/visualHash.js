// Algoritmo dHash (Difference Hash) perceptual de 64 bits para cache visual no navegador
// Roda em < 2ms usando canvas offscreen sem bibliotecas externas

const CACHE_STORAGE_KEY = 'freelancer_visual_cover_cache_v1';
const MAX_CACHE_ENTRIES = 500;
const DEFAULT_HAMMING_THRESHOLD = 6; // Até 6 bits de diferença de 64 bits (tolerância a pequenas variações de luz/ângulo)

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
 * Busca no cache local se existe alguma capa visualmente similar.
 */
export function findInVisualCache(hash, maxDistance = DEFAULT_HAMMING_THRESHOLD) {
  if (!hash || typeof window === 'undefined' || !window.localStorage) return null;

  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw);

    let bestMatch = null;
    let minDistance = maxDistance + 1;

    for (const [cachedHash, item] of Object.entries(cache)) {
      const dist = hammingDistance(hash, cachedHash);
      if (dist <= maxDistance && dist < minDistance) {
        minDistance = dist;
        bestMatch = { ...item, distance: dist, isCached: true };
      }
    }

    return bestMatch;
  } catch (e) {
    console.warn('Erro ao ler cache visual:', e);
    return null;
  }
}

/**
 * Salva uma nova capa e seus metadados no cache visual do navegador.
 */
export function saveToVisualCache(hash, { artista, titulo, ano }) {
  if (!hash || !artista || typeof window === 'undefined' || !window.localStorage) return;

  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    const cache = raw ? JSON.parse(raw) : {};

    cache[hash] = {
      artista: (artista || '').trim(),
      titulo: (titulo || '').trim(),
      ano: (ano || '').trim(),
      timestamp: Date.now()
    };

    // Mantém o cache dentro do limite máximo
    const keys = Object.keys(cache);
    if (keys.length > MAX_CACHE_ENTRIES) {
      keys.sort((a, b) => (cache[a].timestamp || 0) - (cache[b].timestamp || 0));
      const toDelete = keys.slice(0, keys.length - MAX_CACHE_ENTRIES);
      toDelete.forEach(k => delete cache[k]);
    }

    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('Erro ao salvar cache visual:', e);
  }
}
