import { SESSION_COOKIE } from '@/lib/auth-session';

export async function POST() {
  const response = Response.json({ ok: true });
  response.headers.append(
    'Set-Cookie',
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
  );
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
