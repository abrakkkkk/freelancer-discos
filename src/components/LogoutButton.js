'use client';

import { useState } from 'react';
import { MdLogout } from 'react-icons/md';
import { supabase } from '@/lib/supabase';

export default function LogoutButton({ compact = false }) {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await supabase.auth.signOut();
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.assign('/login');
  }

  return (
    <button
      type="button"
      className={`logout-button${compact ? ' logout-button-compact' : ''}`}
      onClick={handleLogout}
      disabled={loading}
      aria-label="Sair do estoque"
      title="Sair do estoque"
    >
      <MdLogout aria-hidden="true" />
      {!compact && <span>{loading ? 'Saindo…' : 'Sair'}</span>}
    </button>
  );
}
