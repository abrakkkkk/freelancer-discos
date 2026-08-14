'use client';

import Link from 'next/link';
import ThemeToggle from './ThemeToggle';

export default function MobileHeader() {
  return (
    <header className="mobile-header">
      <Link href="/" className="mobile-header-brand">
        <img 
          src="/logo.jpg" 
          alt="Freelancer Discos" 
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
