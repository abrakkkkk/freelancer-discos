import { supabase } from '@/lib/supabase';

export const movimentacaoService = {
  /**
   * Registers a new movement (entrada/saida)
   */
  async registerMovement(movData) {
    const { error } = await supabase.from('movimentacoes').insert(movData);
    if (error) throw error;
  },

  /**
   * Registers an initial observation for a new item
   */
  async registerInitialObservation(obsInsert) {
    const { error } = await supabase.from('observacoes_disco').insert(obsInsert);
    if (error) throw error;
  },

  /**
   * Fetches movement history with optional store filter
   */
  async fetchMovimentacoes(filtroPeriodo, filtroTipoMov, filtroLoja = '') {
    let query = supabase
      .from('movimentacoes')
      .select(`
        id, tipo, observacao, criado_em,
        discos ( caixa, artista, titulo, loja ),
        dvds ( titulo, loja, caixa ),
        cds ( artista, titulo, loja, caixa ),
        vhs ( titulo, loja, caixa )
      `)
      .order('criado_em', { ascending: false })
      .limit(200);

    if (filtroPeriodo === 'hoje') {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      query = query.gte('criado_em', hoje.toISOString());
    }
    if (filtroTipoMov) query = query.eq('tipo', filtroTipoMov);

    const { data, error } = await query;
    if (error) throw error;
    
    let results = data || [];
    
    // Filter by store on the client side since the join makes server-side filtering complex
    if (filtroLoja) {
      results = results.filter(m => {
        const item = m.discos || m.dvds || m.cds || m.vhs;
        return item && item.loja === filtroLoja;
      });
    }
    
    return results;
  },

  /**
   * Helper to format movement payload based on category
   */
  createMovementPayload(category, itemId, tipo, quantidade, observacao) {
    const movData = {
      tipo,
      quantidade,
      observacao: observacao || null,
    };

    if (category === 'discos') movData.disco_id = itemId;
    else if (category === 'dvds') movData.dvd_id = itemId;
    else if (category === 'cds') movData.cd_id = itemId;
    else if (category === 'vhs') movData.vhs_id = itemId;

    return movData;
  }
};
