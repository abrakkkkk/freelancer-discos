import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

export async function exportarEstoqueCompleto() {
  async function fetchAll(table, select, orderBy) {
    let allData = [];
    let from = 0;
    const step = 1000;
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select(select)
        .eq('deletado', false)
        .order(orderBy)
        .range(from, from + step - 1);
        
      if (error) throw error;
      if (!data || data.length === 0) break;
      
      allData = allData.concat(data);
      if (data.length < step) break;
      from += step;
    }
    return allData;
  }

  const [ discos, dvds, cds ] = await Promise.all([
    fetchAll('discos', 'caixa, artista, titulo, loja, preco, ativo', 'artista'),
    fetchAll('dvds', 'titulo, loja, preco, ativo', 'titulo'),
    fetchAll('cds', 'artista, titulo, loja, preco, ativo', 'artista')
  ]);

  const formataStatus = (ativo) => ativo !== false ? 'Ativo (Em Estoque)' : 'Inativo (Saída/Vendido)';
  const formataPreco = (preco) => preco ? `R$ ${Number(preco).toFixed(2).replace('.', ',')}` : 'R$ 0,00';

  const discosData = discos?.map(d => ({
    'Caixa': d.caixa || '-',
    'Artista': d.artista || '-',
    'Título': d.titulo || '-',
    'Loja': d.loja || '-',
    'Preço': formataPreco(d.preco),
    'Status': formataStatus(d.ativo)
  })) || [];

  const dvdsData = dvds?.map(d => ({
    'Título': d.titulo || '-',
    'Loja': d.loja || '-',
    'Preço': formataPreco(d.preco),
    'Status': formataStatus(d.ativo)
  })) || [];

  const cdsData = cds?.map(d => ({
    'Artista': d.artista || '-',
    'Título': d.titulo || '-',
    'Loja': d.loja || '-',
    'Preço': formataPreco(d.preco),
    'Status': formataStatus(d.ativo)
  })) || [];

  const wb = XLSX.utils.book_new();
  const wsDiscos = XLSX.utils.json_to_sheet(discosData);
  const wsDvds = XLSX.utils.json_to_sheet(dvdsData);
  const wsCds = XLSX.utils.json_to_sheet(cdsData);

  wsDiscos['!cols'] = [{wch: 8}, {wch: 35}, {wch: 45}, {wch: 15}, {wch: 12}, {wch: 25}];
  wsDvds['!cols'] = [{wch: 45}, {wch: 15}, {wch: 12}, {wch: 25}];
  wsCds['!cols'] = [{wch: 35}, {wch: 45}, {wch: 15}, {wch: 12}, {wch: 25}];

  XLSX.utils.book_append_sheet(wb, wsDiscos, "Discos de Vinil");
  XLSX.utils.book_append_sheet(wb, wsDvds, "DVDs");
  XLSX.utils.book_append_sheet(wb, wsCds, "CDs");

  const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
  XLSX.writeFile(wb, `Estoque_FreelancerDiscos_${hoje}.xlsx`);
}
