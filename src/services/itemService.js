import { supabase } from '@/lib/supabase';
import { removeAcentos } from '@/utils/stringUtils';

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
    const isCd = category === 'cds';
    
    let columns = 'id, titulo, preco, ativo, loja, observacao';
    if (!isVideo) columns += ', artista';
    if (category === 'discos') columns += ', caixa';

    let query = supabase.from(category).select(columns, { count: 'exact' }).eq('deletado', false);

    // Apply active/inactive filters
    if (mostrarAtivos && !mostrarInativos) query = query.eq('ativo', true);
    else if (!mostrarAtivos && mostrarInativos) query = query.eq('ativo', false);
    else if (!mostrarAtivos && !mostrarInativos) return { data: [], count: 0 };

    // Apply other filters
    if (category === 'discos' && filtroCaixa) query = query.eq('caixa', parseInt(filtroCaixa));
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

    // Se houver busca, nós pegamos tudo (até um limite alto) para filtrar no JS ignorando acentos
    if (busca) {
      query = query.limit(5000); // Limite alto para cobrir resultados, já que limitamos a busca
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
    return data;
  },

  /**
   * Updates an existing item
   */
  async updateItem(category, id, updateData) {
    const { error } = await supabase.from(category).update(updateData).eq('id', id);
    if (error) throw error;
  },

  /**
   * Bulk updates items by their IDs
   */
  async bulkUpdate(category, ids, updateData) {
    const { error } = await supabase.from(category).update(updateData).in('id', ids);
    if (error) throw error;
  },

  /**
   * Soft deletes an item
   */
  async deleteItem(category, id) {
    const { error } = await supabase.from(category).update({ deletado: true }).eq('id', id);
    if (error) throw error;
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
