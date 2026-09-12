import { supabase } from '@/lib/supabase';
import { removeAcentos, extractSearchTokens, calculateItemRelevance } from '@/utils/stringUtils';
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
    if (filtroCaixa) {
      const matchB = filtroCaixa.match(/^(?:caixa|c)?\s*(\d+)\s*b$/i);
      const matchNum = filtroCaixa.match(/^(?:caixa|c)?\s*(\d+)$/i);
      if (matchB) {
        const num = matchB[1];
        query = query.in('caixa', [`Caixa ${num}B`, `Caixa ${num}b`, `${num}B`, `${num}b`]);
      } else if (matchNum) {
        const num = matchNum[1];
        query = query.in('caixa', [num, `Caixa ${num}`, `Caixa ${num}B`]);
      } else {
        query = query.eq('caixa', filtroCaixa);
      }
    }
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

    // Se houver busca, aplicamos um pré-filtro no BD usando tokens inteligentes (descartando stop words e ruídos).
    // Isso evita o problema de stop words como 'The' ou hífens '-' ocultarem discos como 'Jacksons - Victory'.
    let searchTokens = null;
    if (busca) {
      searchTokens = extractSearchTokens(busca);
      const { effectiveWords } = searchTokens;

      effectiveWords.forEach(word => {
        // Substitui vogais por curinga do SQL '_' que representa exatamente 1 caractere
        const wildcardWord = word.replace(/[aeiou]/g, '_');
        if (isVideo) {
          query = query.ilike('titulo', `%${wildcardWord}%`);
        } else {
          query = query.or(`titulo.ilike.%${wildcardWord}%,artista.ilike.%${wildcardWord}%,caixa.ilike.%${wildcardWord}%`);
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
    
    // JS Filtering para busca insensível a acentos e resiliente a stop words
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

      // Se a ordenação não foi fixada manualmente pelo usuário, ordena por relevância inteligente
      if (!ordenarColuna) {
        filteredData.sort((a, b) => {
          const scoreA = calculateItemRelevance(a, allWords, effectiveWords, isVideo);
          const scoreB = calculateItemRelevance(b, allWords, effectiveWords, isVideo);
          return scoreB - scoreA;
        });
      }
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
    // Invalida o cache de caixas apenas se uma caixa foi cadastrada
    if (insertData.caixa) {
      caixaService.invalidateCache();
    }
    return data;
  },

  /**
   * Updates an existing item
   */
  async updateItem(category, id, updateData) {
    const { error } = await supabase.from(category).update(updateData).eq('id', id);
    if (error) throw error;
    // Invalida o cache apenas se a caixa ou loja foi alterada
    if (updateData.caixa !== undefined || updateData.loja !== undefined) {
      caixaService.invalidateCache();
    }
  },

  async bulkUpdate(category, ids, updateData) {
    if (!ids || ids.length === 0) return;
    
    // Divide os IDs em pedaços (chunks) menores para evitar erro de URL muito longa no PostgREST
    const chunkSize = 30;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const { error } = await supabase.from(category).update(updateData).in('id', chunk);
      if (error) throw error;
    }
    if (updateData.caixa !== undefined || updateData.loja !== undefined) {
      caixaService.invalidateCache();
    }
  },

  /**
   * Soft deletes an item
   */
  async deleteItem(category, id) {
    const { error } = await supabase.from(category).update({ deletado: true }).eq('id', id);
    if (error) throw error;
  },

  /**
   * Verifica se já existem itens similares cadastrados (duplicatas no estoque)
   */
  async checkDuplicates(category, { titulo, artista }) {
    if (!titulo || titulo.trim().length < 2) return [];

    const isVideo = category === 'dvds' || category === 'vhs';
    const tituloClean = titulo.trim();
    const tituloSemAcento = removeAcentos(tituloClean);

    const { effectiveWords: tituloWords } = extractSearchTokens(tituloClean);

    let columns = 'id, titulo, preco, loja, caixa, ativo, ano';
    if (!isVideo) columns += ', artista';

    let query = supabase
      .from(category)
      .select(columns)
      .eq('deletado', false);

    const words = tituloWords.slice(0, 3);
    words.forEach(word => {
      if (word.length >= 2) {
        const wildcardWord = word.replace(/[aeiou]/g, '_');
        query = query.ilike('titulo', `%${wildcardWord}%`);
      }
    });

    let artistaWords = [];
    if (!isVideo && artista && artista.trim().length >= 2) {
      artistaWords = extractSearchTokens(artista).effectiveWords;
      artistaWords.slice(0, 2).forEach(w => {
        if (w.length >= 2) {
          const wildcard = w.replace(/[aeiou]/g, '_');
          query = query.ilike('artista', `%${wildcard}%`);
        }
      });
    }

    query = query.limit(15);

    const { data, error } = await query;
    if (error || !data) return [];

    const filtered = data.filter(item => {
      const itemTitulo = removeAcentos(item.titulo || '');
      const itemArtista = removeAcentos(item.artista || '');

      const matchTitulo = tituloWords.length > 0
        ? tituloWords.every(w => itemTitulo.includes(w))
        : (itemTitulo.includes(tituloSemAcento) || tituloSemAcento.includes(itemTitulo));
      if (isVideo) return matchTitulo;

      if (artista && artista.trim().length >= 2) {
        const matchArtista = artistaWords.length > 0
          ? artistaWords.every(w => itemArtista.includes(w))
          : true;
        return matchTitulo && matchArtista;
      }

      return matchTitulo;
    });

    return filtered.slice(0, 5);
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
  },

  /**
   * Busca cópias inativas (Estoque Superior) para reposição
   */
  async findReplacements(category, { titulo, artista, excludeId = null }) {
    if (!titulo || titulo.trim().length < 2) return [];

    const isVideo = category === 'dvds' || category === 'vhs';
    const tituloClean = titulo.trim();
    const tituloSemAcento = removeAcentos(tituloClean);
    const { effectiveWords: tituloWords } = extractSearchTokens(tituloClean);

    let columns = 'id, titulo, preco, loja, caixa, ativo, ano';
    if (!isVideo) columns += ', artista';

    let query = supabase
      .from(category)
      .select(columns)
      .eq('deletado', false)
      .eq('ativo', false);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const words = tituloWords.slice(0, 3);
    words.forEach(word => {
      if (word.length >= 2) {
        const wildcardWord = word.replace(/[aeiou]/g, '_');
        query = query.ilike('titulo', `%${wildcardWord}%`);
      }
    });

    let artistaWords = [];
    if (!isVideo && artista && artista.trim().length >= 2) {
      artistaWords = extractSearchTokens(artista).effectiveWords;
      artistaWords.slice(0, 2).forEach(w => {
        if (w.length >= 2) {
          const wildcard = w.replace(/[aeiou]/g, '_');
          query = query.ilike('artista', `%${wildcard}%`);
        }
      });
    }

    const { data, error } = await query.limit(10);
    if (error || !data) return [];

    return data.filter(item => {
      const itemTitulo = removeAcentos(item.titulo || '');
      const matchTitulo = tituloWords.length > 0
        ? tituloWords.every(w => itemTitulo.includes(w))
        : (itemTitulo.includes(tituloSemAcento) || tituloSemAcento.includes(itemTitulo));

      if (!isVideo && artista) {
        const itemArtista = removeAcentos(item.artista || '');
        const matchArtista = artistaWords.length > 0
          ? artistaWords.every(w => itemArtista.includes(w))
          : true;
        return matchTitulo && matchArtista;
      }
      return matchTitulo;
    });
  },

  /**
   * Efetiva a reposição: ativa o disco reserva do Estoque Superior e move para a caixa de destino
   */
  async promoteReplacement(category, replacementId, targetCaixa, targetLoja) {
    const updateData = { ativo: true };
    if (targetCaixa) updateData.caixa = targetCaixa;
    if (targetLoja) updateData.loja = targetLoja;
    await this.updateItem(category, replacementId, updateData);
  }
};
