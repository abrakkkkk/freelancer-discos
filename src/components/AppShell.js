'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import BottomNav from '@/components/BottomNav';
import MobileHeader from '@/components/MobileHeader';
import { UndoProvider } from '@/contexts/UndoContext';
import { StoreProvider } from '@/contexts/StoreContext';
import { ReposicaoProvider } from '@/contexts/ReposicaoContext';
import UndoToast from '@/components/UndoToast';
import LoginForm from '@/components/LoginForm';
import { supabase } from '@/lib/supabase';

async function establishProxySession(accessToken) {
  return fetch('/api/auth/session', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
}

export default function AppShell({ children }) {
  const pathname = usePathname();
  const [authStatus, setAuthStatus] = useState('checking');

  useEffect(() => {
    if (pathname === '/login') return undefined;
    let active = true;

    const validateSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      if (!session) {
        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
        window.location.replace(`/login?next=${encodeURIComponent(`${pathname}${window.location.search}`)}`);
        return;
      }

      const response = await establishProxySession(session.access_token).catch(() => null);
      if (!active) return;
      if (!response?.ok) {
        await supabase.auth.signOut();
        window.location.replace('/login');
        return;
      }
      setAuthStatus('ready');
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        void fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
          window.location.replace('/login');
        });
      }
    });

    void validateSession();
    const refreshTimer = window.setInterval(() => { void validateSession(); }, 10 * 60 * 1000);
    const refreshOnReturn = () => {
      if (document.visibilityState === 'visible') void validateSession();
    };
    document.addEventListener('visibilitychange', refreshOnReturn);

    return () => {
      active = false;
      subscription.unsubscribe();
      window.clearInterval(refreshTimer);
      document.removeEventListener('visibilitychange', refreshOnReturn);
    };
  }, [pathname]);

  if (pathname === '/login') return <LoginForm />;
  if (authStatus !== 'ready') {
    return <main className="auth-loading" role="status" aria-live="polite">Validando acesso ao estoque…</main>;
  }

  return (
    <UndoProvider>
      <StoreProvider>
        <ReposicaoProvider>
          <div className="app-layout">
            <Sidebar />
            <div className="main-wrapper">
              <MobileHeader />
              <main className="main-content">{children}</main>
            </div>
            <BottomNav />
            <UndoToast />
          </div>
        </ReposicaoProvider>
      </StoreProvider>
    </UndoProvider>
  );
}
