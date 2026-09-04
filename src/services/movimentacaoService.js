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
   * Fetches movement history with optional store and period filter
   */
  async fetchMovimentacoes(filtroPeriodo = 'semana', filtroTipoMov = '', filtroLoja = '') {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    let dateFilter = null;
    if (filtroPeriodo === 'hoje') {
      dateFilter = hoje.toISOString();
    } else if (filtroPeriodo === 'semana') {
      const semana = new Date();
      semana.setDate(semana.getDate() - 7);
      semana.setHours(0, 0, 0, 0);
      dateFilter = semana.toISOString();
    } else if (filtroPeriodo === 'mes') {
      const mes = new Date();
      mes.setDate(mes.getDate() - 30);
      mes.setHours(0, 0, 0, 0);
      dateFilter = mes.toISOString();
    }

    let allData = [];
    let from = 0;
    const step = 1000;
    const maxRows = filtroPeriodo === 'todos' ? 3000 : 5000;

    while (allData.length < maxRows) {
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
        .range(from, from + step - 1);

      if (dateFilter) {
        query = query.gte('criado_em', dateFilter);
      }
      if (filtroTipoMov) {
        query = query.eq('tipo', filtroTipoMov);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) break;

      allData = allData.concat(data);
      if (data.length < step) break;
      from += step;
    }

    let results = allData;

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
