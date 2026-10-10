import { supabase } from '@/lib/supabase';

/**
 * Retorna a data de corte em formato ISO para o período especificado
 * @param {'hoje' | 'semana' | 'mes' | 'todos'} filtroPeriodo
 * @returns {string | null}
 */
function calcularDataInicioPeriodo(filtroPeriodo) {
  const agora = new Date();
  agora.setHours(0, 0, 0, 0);

  if (filtroPeriodo === 'hoje') {
    return agora.toISOString();
  }

  if (filtroPeriodo === 'semana') {
    const dataSemana = new Date(agora);
    dataSemana.setDate(dataSemana.getDate() - 7);
    return dataSemana.toISOString();
  }

  if (filtroPeriodo === 'mes') {
    const dataMes = new Date(agora);
    dataMes.setDate(dataMes.getDate() - 30);
    return dataMes.toISOString();
  }

  return null;
}

export const movimentacaoService = {
  /**
   * Registra uma única movimentação de entrada ou saída no histórico
   */
  async registerMovement(payloadMovimentacao) {
    const { error } = await supabase.from('movimentacoes').insert(payloadMovimentacao);
    if (error) throw error;
  },

  /**
   * Registra múltiplas movimentações de entrada ou saída em lote
   */
  async registerBatchMovements(listaMovimentacoes) {
    if (!listaMovimentacoes || listaMovimentacoes.length === 0) return;

    // Divide em blocos de 50 para evitar sobrecarga no payload do PostgREST
    const tamanhoBloco = 50;
    for (let i = 0; i < listaMovimentacoes.length; i += tamanhoBloco) {
      const bloco = listaMovimentacoes.slice(i, i + tamanhoBloco);
      const { error } = await supabase.from('movimentacoes').insert(bloco);
      if (error) throw error;
    }
  },

  /**
   * Registra observação inicial para um novo disco cadastrado
   */
  async registerInitialObservation(dadosObservacao) {
    const { error } = await supabase.from('observacoes_disco').insert(dadosObservacao);
    if (error) throw error;
  },

  /**
   * Busca histórico de movimentações com paginação automática e filtros de período, tipo e loja
   */
  async fetchMovimentacoes(filtroPeriodo = 'semana', filtroTipoMov = '', filtroLoja = '') {
    const dataInicioFiltro = calcularDataInicioPeriodo(filtroPeriodo);
    const limiteMaximoLinhas = filtroPeriodo === 'todos' ? 3000 : 5000;
    const tamanhoPagina = 1000;

    let registrosCompletos = [];
    let offset = 0;

    while (registrosCompletos.length < limiteMaximoLinhas) {
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
        .range(offset, offset + tamanhoPagina - 1);

      if (dataInicioFiltro) {
        query = query.gte('criado_em', dataInicioFiltro);
      }

      if (filtroTipoMov) {
        query = query.eq('tipo', filtroTipoMov);
      }

      const { data: paginaRegistros, error } = await query;
      if (error) throw error;
      if (!paginaRegistros || paginaRegistros.length === 0) break;

      registrosCompletos = registrosCompletos.concat(paginaRegistros);
      if (paginaRegistros.length < tamanhoPagina) break;

      offset += tamanhoPagina;
    }

    // Filtragem em memória para loja devido à complexidade de joins dinâmicos do Supabase
    if (filtroLoja) {
      return registrosCompletos.filter((movimentacao) => {
        const itemRelacionado =
          movimentacao.discos || movimentacao.dvds || movimentacao.cds || movimentacao.vhs;
        return itemRelacionado && itemRelacionado.loja === filtroLoja;
      });
    }

    return registrosCompletos;
  },

  /**
   * Constrói o payload padronizado da movimentação associando à chave estrangeira correta
   */
  createMovementPayload(category, itemId, tipo, quantidade, observacao) {
    const payload = {
      tipo,
      quantidade: quantidade || 1,
      observacao: observacao || null,
    };

    switch (category) {
      case 'discos':
        payload.disco_id = itemId;
        break;
      case 'dvds':
        payload.dvd_id = itemId;
        break;
      case 'cds':
        payload.cd_id = itemId;
        break;
      case 'vhs':
        payload.vhs_id = itemId;
        break;
      default:
        break;
    }

    return payload;
  },
};
