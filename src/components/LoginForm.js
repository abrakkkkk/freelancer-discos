'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';

function safeReturnPath() {
  const requestedPath = new URLSearchParams(window.location.search).get('next');
  return requestedPath?.startsWith('/') && !requestedPath.startsWith('//') ? requestedPath : '/';
}

async function establishProxySession(accessToken) {
  return fetch('/api/auth/session', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
}

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active || !session) return;
      try {
        const response = await establishProxySession(session.access_token);
        if (response.ok && active) window.location.replace(safeReturnPath());
      } catch {
        if (active) setError('Não foi possível validar sua sessão. Verifique a conexão e tente novamente.');
      }
    });
    return () => { active = false; };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError || !data.session) {
        throw new Error('E-mail ou senha incorretos.');
      }

      const response = await establishProxySession(data.session.access_token);
      if (!response.ok) {
        await supabase.auth.signOut();
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Não foi possível iniciar uma sessão segura.');
      }

      window.location.assign(safeReturnPath());
    } catch (loginError) {
      setError(loginError.message || 'Falha de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-panel" aria-labelledby="login-title">
        <Image
          className="login-logo"
          src="/logo-login.png"
          alt="Freelancer Discos"
          width={912}
          height={548}
          priority
        />
        <h1 id="login-title">Estoque</h1>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="login-email">E-mail</label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="login-password">Senha</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="btn btn-primary login-submit" type="submit" disabled={loading}>
            Entrar
          </button>
        </form>
      </section>
    </main>
  );
}
