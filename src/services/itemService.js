import { supabase } from '@/lib/supabase';

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
    
    if (busca) {
      const words = busca.trim().split(/\s+/);
      if (isVideo) {
        words.forEach(word => query = query.ilike('titulo', `%${word}%`));
      } else {
        words.forEach(word => query = query.or(`artista.ilike.%${word}%,titulo.ilike.%${word}%`));
      }
    }

    // Apply sorting
    if (ordenarColuna && ordenarDirecao) {
      const ascending = ordenarDirecao === 'asc';
      query = query.order(ordenarColuna, { ascending, nullsFirst: ascending });
    } else {
      if (category === 'discos') query = query.order('caixa');
      if (!isVideo) query = query.order('artista');
      query = query.order('titulo');
    }

    // Apply pagination
    query = query.range((pagina - 1) * itensPorPagina, pagina * itensPorPagina - 1);

    const { data, count, error } = await query;
    if (error) throw error;
    
    return { data, count };
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

    if (campo === 'artista') {
      const { data, error } = await supabase
        .from(category)
        .select('artista')
        .ilike('artista', `%${valor.trim()}%`)
        .limit(20);
      
      if (error) throw error;
      return [...new Set(data.map(d => d.artista).filter(Boolean))];
    } 
    
    if (campo === 'titulo') {
      const isVideo = category === 'dvds' || category === 'vhs';
      const colunas = isVideo ? 'titulo, preco, loja' : 'artista, titulo, preco, loja';
      
      const { data, error } = await supabase
        .from(category)
        .select(colunas)
        .ilike('titulo', `%${valor.trim()}%`)
        .order('id', { ascending: false })
        .limit(30);

      if (error) throw error;
      
      const unicas = [];
      const seen = new Set();
      for (const d of data) {
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
