import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

export async function exportarEstoqueCompleto(filtroLoja = '') {
  async function fetchAll(table, select, orderBy) {
    let allData = [];
    let from = 0;
    const step = 1000;
    while (true) {
      let query = supabase
        .from(table)
        .select(select)
        .eq('deletado', false)
        .order(orderBy)
        .range(from, from + step - 1);
      
      if (filtroLoja) query = query.eq('loja', filtroLoja);
        
      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) break;
      
      allData = allData.concat(data);
      if (data.length < step) break;
      from += step;
    }
    return allData;
  }

  const [ discos, dvds, cds, vhs ] = await Promise.all([
    fetchAll('discos', 'caixa, artista, titulo, loja, preco, ativo, ano', 'artista'),
    fetchAll('dvds', 'caixa, titulo, loja, preco, ativo, ano', 'titulo'),
    fetchAll('cds', 'caixa, artista, titulo, loja, preco, ativo, ano', 'artista'),
    fetchAll('vhs', 'caixa, titulo, loja, preco, ativo, ano', 'titulo')
  ]);

  const formataStatus = (ativo) => ativo !== false ? 'Ativo (Em Estoque)' : 'Inativo (Saída/Vendido)';
  const formataPreco = (preco) => preco ? `R$ ${Number(preco).toFixed(2).replace('.', ',')}` : 'R$ 0,00';

  const discosData = discos?.map(d => ({
    'Localização': d.caixa || '-',
    'Artista': d.artista || '-',
    'Título': d.titulo || '-',
    'Ano': d.ano || '-',
    'Loja': d.loja || '-',
    'Preço': formataPreco(d.preco),
    'Status': formataStatus(d.ativo)
  })) || [];

  const dvdsData = dvds?.map(d => ({
    'Localização': d.caixa || '-',
    'Título': d.titulo || '-',
    'Ano': d.ano || '-',
    'Loja': d.loja || '-',
    'Preço': formataPreco(d.preco),
    'Status': formataStatus(d.ativo)
  })) || [];

  const cdsData = cds?.map(d => ({
    'Localização': d.caixa || '-',
    'Artista': d.artista || '-',
    'Título': d.titulo || '-',
    'Ano': d.ano || '-',
    'Loja': d.loja || '-',
    'Preço': formataPreco(d.preco),
    'Status': formataStatus(d.ativo)
  })) || [];

  const vhsData = vhs?.map(d => ({
    'Localização': d.caixa || '-',
    'Título': d.titulo || '-',
    'Ano': d.ano || '-',
    'Loja': d.loja || '-',
    'Preço': formataPreco(d.preco),
    'Status': formataStatus(d.ativo)
  })) || [];

  const wb = XLSX.utils.book_new();
  const wsDiscos = XLSX.utils.json_to_sheet(discosData);
  const wsDvds = XLSX.utils.json_to_sheet(dvdsData);
  const wsCds = XLSX.utils.json_to_sheet(cdsData);
  const wsVhs = XLSX.utils.json_to_sheet(vhsData);

  wsDiscos['!cols'] = [{wch: 15}, {wch: 35}, {wch: 45}, {wch: 10}, {wch: 15}, {wch: 12}, {wch: 25}];
  wsDvds['!cols'] = [{wch: 15}, {wch: 45}, {wch: 10}, {wch: 15}, {wch: 12}, {wch: 25}];
  wsCds['!cols'] = [{wch: 15}, {wch: 35}, {wch: 45}, {wch: 10}, {wch: 15}, {wch: 12}, {wch: 25}];
  wsVhs['!cols'] = [{wch: 15}, {wch: 45}, {wch: 10}, {wch: 15}, {wch: 12}, {wch: 25}];

  XLSX.utils.book_append_sheet(wb, wsDiscos, "Discos de Vinil");
  XLSX.utils.book_append_sheet(wb, wsDvds, "DVDs");
  XLSX.utils.book_append_sheet(wb, wsCds, "CDs");
  XLSX.utils.book_append_sheet(wb, wsVhs, "VHS");

  const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
  const suffix = filtroLoja ? `_${filtroLoja.replace(/\s+/g, '_')}` : '';
  XLSX.writeFile(wb, `Estoque_FreelancerDiscos${suffix}_${hoje}.xlsx`);
}
