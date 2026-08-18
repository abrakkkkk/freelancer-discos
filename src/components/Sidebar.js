'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PiVinylRecord } from "react-icons/pi";
import { IoIosAddCircleOutline } from "react-icons/io";
import { MdCurrencyExchange, MdLayers, MdDownload } from "react-icons/md";
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

const links = [
  { href: '/', label: 'Catálogo', icon: <PiVinylRecord size={18} /> },
  { href: '/adicionar', label: 'Adicionar Itens', icon: <IoIosAddCircleOutline size={18} /> },
  { href: '/lote', label: 'Alteração em Lote', icon: <MdLayers size={18} /> },
  { href: '/saida', label: 'Saídas e Histórico', icon: <MdCurrencyExchange size={18} /> },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [exportando, setExportando] = useState(false);

  async function exportarEstoque() {
    setExportando(true);
    try {
      // Busca todos os dados (até 10.000 para não estourar caso cresça)
      const [ { data: discos }, { data: dvds }, { data: cds } ] = await Promise.all([
        supabase.from('discos').select('caixa, artista, titulo, loja, preco, ativo').order('artista').limit(10000),
        supabase.from('dvds').select('titulo, loja, preco, ativo').order('titulo').limit(10000),
        supabase.from('cds').select('artista, titulo, loja, preco, ativo').order('artista').limit(10000)
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

      // Cria a planilha (Workbook) e as abas (Worksheets)
      const wb = XLSX.utils.book_new();
      
      const wsDiscos = XLSX.utils.json_to_sheet(discosData);
      const wsDvds = XLSX.utils.json_to_sheet(dvdsData);
      const wsCds = XLSX.utils.json_to_sheet(cdsData);

      // Ajusta largura aproximada das colunas pra ficar bonitinho
      wsDiscos['!cols'] = [{wch: 8}, {wch: 35}, {wch: 45}, {wch: 15}, {wch: 12}, {wch: 25}];
      wsDvds['!cols'] = [{wch: 45}, {wch: 15}, {wch: 12}, {wch: 25}];
      wsCds['!cols'] = [{wch: 35}, {wch: 45}, {wch: 15}, {wch: 12}, {wch: 25}];

      XLSX.utils.book_append_sheet(wb, wsDiscos, "Discos de Vinil");
      XLSX.utils.book_append_sheet(wb, wsDvds, "DVDs");
      XLSX.utils.book_append_sheet(wb, wsCds, "CDs");

      // Força o download
      const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      XLSX.writeFile(wb, `Estoque_FreelancerDiscos_${hoje}.xlsx`);

    } catch (err) {
      console.error("Erro ao exportar:", err);
      alert("Houve um erro ao gerar a planilha. Tente novamente.");
    }
    setExportando(false);
  }

  return (
    <aside className="sidebar">
      <div className="logo_free" style={{ textAlign: 'center', marginBottom: '12px' }}>
          <img src="/logo.jpg" alt="Freelancer Discos" style={{ maxWidth: '100px', borderRadius: '50%' }} />
      </div>
      <div className="sidebar-title">Estoque de Discos</div>
      <nav>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={pathname === link.href ? 'active' : ''}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {link.icon && <span>{link.icon}</span>}
            {link.label}
          </Link>
        ))}
      </nav>

      <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
        <button 
          onClick={exportarEstoque} 
          disabled={exportando}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '8px', 
            width: '100%', padding: '12px 16px', borderRadius: '8px',
            background: 'var(--accent)', color: '#fff', border: 'none',
            cursor: exportando ? 'not-allowed' : 'pointer', fontSize: '14px',
            fontWeight: 600, opacity: exportando ? 0.7 : 1, transition: '0.2s'
          }}
        >
          <MdDownload size={18} />
          {exportando ? 'Gerando Planilha...' : 'Exportar Excel (.xlsx)'}
        </button>
      </div>
    </aside>
  );
}
