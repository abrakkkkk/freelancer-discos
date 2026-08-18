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
   * Fetches movement history
   */
  async fetchMovimentacoes(filtroPeriodo, filtroTipoMov) {
    let query = supabase
      .from('movimentacoes')
      .select(`
        id, tipo, observacao, criado_em,
        discos ( caixa, artista, titulo ),
        dvds ( titulo ),
        cds ( artista, titulo ),
        vhs ( titulo )
      `)
      .order('criado_em', { ascending: false })
      .limit(100);

    if (filtroPeriodo === 'hoje') {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      query = query.gte('criado_em', hoje.toISOString());
    }
    if (filtroTipoMov) query = query.eq('tipo', filtroTipoMov);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
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
