'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { PiVinylRecord } from "react-icons/pi";
import { IoIosAddCircleOutline } from "react-icons/io";
import { MdCurrencyExchange, MdLayers, MdHistory } from "react-icons/md";
import { useStore } from '@/contexts/StoreContext';
import { STORE_OPTIONS } from '@/constants/config';

const links = [
  { href: '/', label: 'Catálogo', icon: <PiVinylRecord size={18} /> },
  { href: '/adicionar', label: 'Adicionar Itens', icon: <IoIosAddCircleOutline size={18} /> },
  { href: '/lote', label: 'Alteração em Lote', icon: <MdLayers size={18} /> },
  { href: '/movimentacoes', label: 'Movimentações', icon: <MdHistory size={18} /> },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { activeStore, setActiveStore } = useStore();

  return (
    <aside className="sidebar">
      <div className="logo_free" style={{ textAlign: 'center', marginBottom: '12px' }}>
        <Image src="/logo.jpg" alt="Freelancer Discos" width={100} height={100} style={{ borderRadius: '50%' }} unoptimized={true} />
      </div>
      <div className="sidebar-title">Estoque Geral</div>

      <div style={{ padding: '0 12px', marginBottom: '16px' }}>
        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
          Loja Ativa
        </label>
        <select
          value={activeStore}
          onChange={(e) => setActiveStore(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 10px',
            borderRadius: '6px',
            border: '2px solid var(--accent)',
            background: 'var(--bg-card)',
            color: 'var(--text)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <option value="">Todas as Lojas</option>
          {STORE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>

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
    </aside>
  );
}
