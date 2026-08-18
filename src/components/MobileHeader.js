'use client';

import Link from 'next/link';
import Image from 'next/image';
import ThemeToggle from './ThemeToggle';

import { usePathname } from 'next/navigation';

export default function MobileHeader() {
  const pathname = usePathname();

  const handleNavigation = (e) => {
    if (window.innerWidth <= 768 && pathname !== '/') {
      const pagesToConfirm = ['/lote', '/saida', '/adicionar'];
      if (pagesToConfirm.includes(pathname)) {
        const confirmed = window.confirm("Você tem certeza que quer sair dessa página?");
        if (!confirmed) {
          e.preventDefault();
        }
      }
    }
  };

  return (
    <header className="mobile-header">
      <Link href="/" className="mobile-header-brand" onClick={handleNavigation}>
        <Image 
          src="/logo.jpg" 
          alt="Freelancer Discos" 
          width={40}
          height={40}
          className="mobile-header-logo"
        />
        <div className="mobile-header-text">
          <span className="mobile-header-title">Freelancer Discos</span>
          <span className="mobile-header-subtitle">Estoque</span>
        </div>
      </Link>
      <div className="mobile-header-actions">
        <ThemeToggle />
      </div>
    </header>
  );
}
