import { supabase } from '@/lib/supabase';

export const caixaService = {
  /**
   * Fetches distinct box numbers (caixas)
   */
  async getCaixas() {
    const { data, error } = await supabase.from('caixas_distintas').select('caixa');
    if (error) throw error;
    return data ? [...new Set(data.map(d => d.caixa))] : [];
  }
};
