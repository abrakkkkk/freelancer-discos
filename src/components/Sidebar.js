'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PiVinylRecord } from "react-icons/pi";
import { IoIosAddCircleOutline } from "react-icons/io";
import { MdCurrencyExchange, MdHistory, MdLayers } from "react-icons/md";
import { TbTools } from "react-icons/tb";

const links = [
  { href: '/', label: 'Catálogo', icon: <PiVinylRecord size={18} /> },
  { href: '/adicionar', label: 'Adicionar Itens', icon: <IoIosAddCircleOutline size={18} /> },
  { href: '/lote', label: 'Alteração em Lote', icon: <MdLayers size={18} /> },
  { href: '/saida', label: 'Saída de Discos', icon: <MdCurrencyExchange size={18} /> },
  { href: '/editar', label: 'Editar / Excluir', icon: <TbTools size={18} /> },
  { href: '/historico', label: 'Histórico', icon: <MdHistory size={18} /> },
];

export default function Sidebar() {
  const pathname = usePathname();

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
    </aside>
  );
}
