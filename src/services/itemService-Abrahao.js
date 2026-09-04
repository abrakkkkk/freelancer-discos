import { supabase } from '@/lib/supabase';
import { removeAcentos } from '@/utils/stringUtils';
import { caixaService } from '@/services/caixaService';

export const itemService = {
  /**
   * Fetches items based on category and filters
   */
  async fetchItems(category, { 
    pagina = 1, 
    itensPorPagina = 50, 
    filtroCaixa = '', 
    filtroLoja = '', 
    busca = '', 
    mostrarAtivos = true, 
    mostrarInativos = false, 
    ordenarColuna = null, 
    ordenarDirecao = null 
  } = {}) {
    
    // Determine columns based on category
    const isVideo = category === 'dvds' || category === 'vhs';
    
    let columns = 'id, titulo, preco, ativo, loja, observacao, caixa, ano';
    if (!isVideo) columns += ', artista';

    let query = supabase.from(category).select(columns, { count: 'exact' }).eq('deletado', false);

    // Apply active/inactive filters
    if (mostrarAtivos && !mostrarInativos) query = query.eq('ativo', true);
    else if (!mostrarAtivos && mostrarInativos) query = query.eq('ativo', false);
    else if (!mostrarAtivos && !mostrarInativos) return { data: [], count: 0 };

    // Apply other filters
    if (filtroCaixa) query = query.eq('caixa', filtroCaixa);
    if (filtroLoja) query = query.eq('loja', filtroLoja);
    
    // Apply sorting BEFORE JS filtering
    if (ordenarColuna && ordenarDirecao) {
      const ascending = ordenarDirecao === 'asc';
      query = query.order(ordenarColuna, { ascending, nullsFirst: ascending });
    } else {
      if (category === 'discos') query = query.order('caixa');
      if (!isVideo) query = query.order('artista');
      query = query.order('titulo');
    }

    // Se houver busca, aplicamos um pré-filtro no BD usando curingas (_) nas vogais.
    // Isso evita o problema do limite de 1000/5000 itens não retornar resultados que estão mais no fim do banco.
    if (busca) {
      const words = removeAcentos(busca).trim().split(/\s+/);
      words.forEach(word => {
        // Substitui vogais por curinga do SQL '_' que representa exatamente 1 caractere
        const wildcardWord = word.replace(/[aeiou]/g, '_');
        if (isVideo) {
          query = query.ilike('titulo', `%${wildcardWord}%`);
        } else {
          query = query.or(`titulo.ilike.%${wildcardWord}%,artista.ilike.%${wildcardWord}%`);
        }
      });
      query = query.limit(5000); // Mantemos limite alto para cobrir falsos positivos
    } else {
      // Apply pagination here ONLY IF NO BUSCA
      query = query.range((pagina - 1) * itensPorPagina, pagina * itensPorPagina - 1);
    }

    const { data, count, error } = await query;
    if (error) throw error;
    
    let filteredData = data || [];
    
    // JS Filtering for accent insensitive search
    if (busca) {
      const words = removeAcentos(busca).trim().split(/\s+/);
      filteredData = filteredData.filter(item => {
        const itemTitulo = removeAcentos(item.titulo || '');
        const itemArtista = removeAcentos(item.artista || '');
        
        return words.every(word => {
          if (isVideo) {
            return itemTitulo.includes(word);
          } else {
            return itemTitulo.includes(word) || itemArtista.includes(word);
          }
        });
      });
    }

    // Apply pagination if JS filtering was used
    let paginatedData = filteredData;
    if (busca) {
       const startIndex = (pagina - 1) * itensPorPagina;
       paginatedData = filteredData.slice(startIndex, startIndex + itensPorPagina);
    }
    
    return { data: paginatedData, count: busca ? filteredData.length : count };
  },

  /**
   * Fetches a single item by id
   */
  async getItemById(category, id) {
    const { data, error } = await supabase.from(category).select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },

  /**
   * Adds a new item
   */
  async addItem(category, insertData) {
    const { data, error } = await supabase.from(category).insert(insertData).select('id').single();
    if (error) throw error;
    caixaService.invalidateCache();
    return data;
  },

  /**
   * Updates an existing item
   */
  async updateItem(category, id, updateData) {
    const { error } = await supabase.from(category).update(updateData).eq('id', id);
    if (error) throw error;
    caixaService.invalidateCache();
  },

  async bulkUpdate(category, ids, updateData) {
    if (!ids || ids.length === 0) return;
    
    // Divide os IDs em pedaços (chunks) menores para evitar erro de URL muito longa no PostgREST
    // Limite da URL é geralmente 2048 chars. Se o ID for UUID (36 chars), 30 IDs = ~1110 chars.
    const chunkSize = 30;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const { error } = await supabase.from(category).update(updateData).in('id', chunk);
      if (error) throw error;
    }
    caixaService.invalidateCache();
  },

  /**
   * Soft deletes an item
   */
  async deleteItem(category, id) {
    const { error } = await supabase.from(category).update({ deletado: true }).eq('id', id);
    if (error) throw error;
    caixaService.invalidateCache();
  },

  /**
   * Search suggestions for autocomplete
   */
  async searchSuggestions(category, campo, valor) {
    if (!valor || valor.trim().length < 2) return [];
    const buscaTratada = removeAcentos(valor).trim();

    if (campo === 'artista') {
      // Fetch 500 latest artist entries and filter client side
      const { data, error } = await supabase
        .from(category)
        .select('artista')
        .order('id', { ascending: false })
        .limit(1000);
      
      if (error) throw error;
      
      const filtered = data.filter(d => removeAcentos(d.artista).includes(buscaTratada));
      return [...new Set(filtered.map(d => d.artista).filter(Boolean))].slice(0, 20);
    } 
    
    if (campo === 'titulo') {
      const isVideo = category === 'dvds' || category === 'vhs';
      const colunas = isVideo ? 'titulo, preco, loja' : 'artista, titulo, preco, loja';
      
      const { data, error } = await supabase
        .from(category)
        .select(colunas)
        .order('id', { ascending: false })
        .limit(1000);

      if (error) throw error;
      
      const filtered = data.filter(d => removeAcentos(d.titulo).includes(buscaTratada));
      
      const unicas = [];
      const seen = new Set();
      for (const d of filtered) {
        if (unicas.length >= 30) break;
        const key = isVideo ? d.titulo : `${d.artista}-${d.titulo}`;
        if (!seen.has(key)) {
          seen.add(key);
          unicas.push(d);
        }
      }
      return unicas;
    }
    return [];
  }
};
