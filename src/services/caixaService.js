import { supabase } from '@/lib/supabase';

const CACHE_TTL = 10 * 60 * 1000; // 10 minutos
const STORAGE_PREFIX = 'freelancer_caixas_';

function formatAndSortCaixas(rawData) {
  const allCaixas = new Map();

  rawData.forEach((d) => {
    if (d && d.caixa) {
      const key = `${d.caixa}|${d.loja || ''}`;
      if (!allCaixas.has(key)) {
        const isNumeric = !isNaN(Number(d.caixa)) && String(d.caixa).trim() !== '';
        const label = d.loja === 'Loja 1' && isNumeric ? `Caixa ${d.caixa}` : d.caixa;

        allCaixas.set(key, {
          caixa: d.caixa,
          loja: d.loja || '',
          label: label,
        });
      }
    }
  });

  return Array.from(allCaixas.values()).sort((a, b) => {
    const numA = Number(a.caixa);
    const numB = Number(b.caixa);
    if (!isNaN(numA) && !isNaN(numB)) {
      if (numA === numB) return a.loja.localeCompare(b.loja);
      return numA - numB;
    }
    const compCaixa = String(a.caixa).localeCompare(String(b.caixa));
    if (compCaixa === 0) return a.loja.localeCompare(b.loja);
    return compCaixa;
  });
}

function getFromSession(key) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp < CACHE_TTL) {
      return parsed.data;
    }
  } catch (e) {}
  return null;
}

function saveToSession(key, data) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      STORAGE_PREFIX + key,
      JSON.stringify({ timestamp: Date.now(), data })
    );
  } catch (e) {}
}

export const caixaService = {
  _cacheMap: new Map(),

  /**
   * Fetches distinct locations (caixas/localizações), optionally filtered by store.
   * Utilizes RPC when available for ~15ms response times, and falls back to
   * optimized parallel pagination with multi-layer caching (Memory + SessionStorage).
   */
  async getCaixas(loja = '') {
    const cacheKey = loja || 'ALL';

    // 1. Memória RAM (0ms)
    const memCached = this._cacheMap.get(cacheKey);
    if (memCached && Date.now() - memCached.timestamp < CACHE_TTL) {
      return memCached.data;
    }

    // 2. SessionStorage do Navegador (0ms - persiste entre trocas de páginas)
    const sessionCached = getFromSession(cacheKey);
    if (sessionCached) {
      this._cacheMap.set(cacheKey, { timestamp: Date.now(), data: sessionCached });
      return sessionCached;
    }

    // 3. Tentar via RPC no Supabase (se configurado no banco, executa em ~15ms)
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_distinct_caixas', {
        p_loja: loja || null,
      });

      if (!rpcError && rpcData && Array.isArray(rpcData)) {
        const sortedCaixas = formatAndSortCaixas(rpcData);
        this._cacheMap.set(cacheKey, { timestamp: Date.now(), data: sortedCaixas });
        saveToSession(cacheKey, sortedCaixas);
        return sortedCaixas;
      }
    } catch (e) {
      // Se a RPC não existir ainda, cai para o fallback seguro
    }

    // 4. Fallback: Varredura paginada paralela nas tabelas
    const tables = ['discos', 'dvds', 'cds', 'vhs'];
    const step = 1000;

    const tablePromises = tables.map(async (table) => {
      let countQuery = supabase
        .from(table)
        .select('caixa', { count: 'exact', head: true })
        .eq('deletado', false)
        .not('caixa', 'is', null);

      if (loja) {
        countQuery = countQuery.eq('loja', loja);
      }

      const { count, error } = await countQuery;
      if (error || !count) return [];

      const pagePromises = [];
      for (let from = 0; from < count; from += step) {
        let query = supabase
          .from(table)
          .select('caixa, loja')
          .eq('deletado', false)
          .not('caixa', 'is', null)
          .range(from, from + step - 1);

        if (loja) {
          query = query.eq('loja', loja);
        }
        pagePromises.push(query);
      }

      const pages = await Promise.all(pagePromises);
      return pages.flatMap((p) => p.data || []);
    });

    const results = await Promise.all(tablePromises);
    const sortedCaixas = formatAndSortCaixas(results.flat());

    // Salvar nos 2 níveis de cache
    this._cacheMap.set(cacheKey, { timestamp: Date.now(), data: sortedCaixas });
    saveToSession(cacheKey, sortedCaixas);

    return sortedCaixas;
  },

  /**
   * Invalida o cache quando novas caixas ou lojas são criadas/modificadas
   */
  invalidateCache() {
    if (this._cacheMap) {
      this._cacheMap.clear();
    }
    if (typeof window !== 'undefined') {
      try {
        Object.keys(sessionStorage).forEach((k) => {
          if (k.startsWith(STORAGE_PREFIX)) {
            sessionStorage.removeItem(k);
          }
        });
      } catch (e) {}
    }
  },
};
