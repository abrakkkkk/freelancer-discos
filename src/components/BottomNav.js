'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PiVinylRecord } from "react-icons/pi";
import { IoIosAddCircleOutline } from "react-icons/io";
import { MdCurrencyExchange, MdHistory, MdLayers } from "react-icons/md";
import { TbTools } from "react-icons/tb";

const links = [
  { href: '/', label: 'Catálogo', icon: <PiVinylRecord size={24} /> },
  { href: '/adicionar', label: 'Adicionar', icon: <IoIosAddCircleOutline size={24} /> },
  { href: '/lote', label: 'Lotes', icon: <MdLayers size={24} /> },
  { href: '/saida', label: 'Saída', icon: <MdCurrencyExchange size={24} /> },
  { href: '/editar', label: 'Editar', icon: <TbTools size={24} /> },
  { href: '/historico', label: 'Histórico', icon: <MdHistory size={24} /> },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`bottom-nav-item ${pathname === link.href ? 'active' : ''}`}
        >
          {link.icon}
          <span>{link.label}</span>
        </Link>
      ))}
    </nav>
  );
}
