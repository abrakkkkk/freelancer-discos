'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PiVinylRecord } from "react-icons/pi";
import { IoIosAddCircleOutline } from "react-icons/io";
import { MdCurrencyExchange, MdHistory, MdLayers } from "react-icons/md";
import { TbTools } from "react-icons/tb";

const links = [
  { href: '/', label: 'Catálogo', icon: <PiVinylRecord size={20} /> },
  { href: '/adicionar', label: 'Adicionar', icon: <IoIosAddCircleOutline size={20} /> },
  { href: '/lote', label: 'Lotes', icon: <MdLayers size={20} /> },
  { href: '/movimentacoes', label: 'Histórico', icon: <MdHistory size={20} /> },
];

import { useState } from 'react';
import { MdDownload } from "react-icons/md";

export default function BottomNav() {
  const pathname = usePathname();
  const [exportando, setExportando] = useState(false);

  async function handleExport() {
    setExportando(true);
    try {
      const { exportarEstoqueCompleto } = await import('@/utils/export');
      await exportarEstoqueCompleto();
    } catch (err) {
      console.error(err);
      alert('Erro ao exportar planilha');
    }
    setExportando(false);
  }

  return (
    <nav className="bottom-nav" aria-label="Navegação móvel inferior">
      <div className="bottom-nav-container">
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            >
              <div className="bottom-nav-icon-wrapper">
                {link.icon}
              </div>
              <span className="bottom-nav-label">{link.label}</span>
            </Link>
          );
        })}
        <button 
          className="bottom-nav-item" 
          onClick={handleExport}
          disabled={exportando}
          style={{ background: 'none', border: 'none', cursor: exportando ? 'wait' : 'pointer', fontFamily: 'inherit' }}
        >
          <div className="bottom-nav-icon-wrapper">
            <MdDownload size={20} />
          </div>
          <span className="bottom-nav-label">{exportando ? '...' : 'Exportar'}</span>
        </button>
      </div>
    </nav>
  );
}
