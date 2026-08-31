import { supabase } from '@/lib/supabase';

// Cache to store the fetched locations temporarily
let caixasCache = null;
let lastFetchTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const caixaService = {
  /**
   * Fetches distinct locations (caixas/localizações), optionally filtered by store
   */
  async getCaixas(loja = '') {
    // Check if we have a valid cache for this specific store filter
    // To simplify, we cache the all-store version and filter it, or cache by store.
    // Since this is mostly used with the activeStore, let's cache by store string.
    if (!this._cacheMap) this._cacheMap = new Map();
    const cacheKey = loja || 'ALL';
    
    const cachedData = this._cacheMap.get(cacheKey);
    if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL)) {
      return cachedData.data;
    }

    const tables = ['discos', 'dvds', 'cds', 'vhs'];
    const allCaixas = new Map();
    const step = 1000;
    
    // Process each table in parallel
    const tablePromises = tables.map(async (table) => {
      // First get the count of items with non-null caixas
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
      
      // Then fetch all pages in parallel
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
      return pages.flatMap(p => p.data || []);
    });
    
    // Wait for all tables and all their pages
    const results = await Promise.all(tablePromises);
    
    results.flat().forEach(d => {
      if (d && d.caixa) {
        const key = `${d.caixa}|${d.loja || ''}`;
        if (!allCaixas.has(key)) {
          // Create the formatted label
          const isNumeric = !isNaN(Number(d.caixa)) && String(d.caixa).trim() !== '';
          const label = (d.loja === 'Loja 1' && isNumeric) ? `Caixa ${d.caixa}` : d.caixa;
          
          allCaixas.set(key, { 
            caixa: d.caixa, 
            loja: d.loja || '',
            label: label
          });
        }
      }
    });
    
    const sortedCaixas = Array.from(allCaixas.values()).sort((a, b) => {
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

    // Save to cache
    this._cacheMap.set(cacheKey, {
      timestamp: Date.now(),
      data: sortedCaixas
    });

    return sortedCaixas;
  },

  /**
   * Invalidate cache (useful after bulk updates or adding new items with new locations)
   */
  invalidateCache() {
    if (this._cacheMap) {
      this._cacheMap.clear();
    }
  }
};
