import { NextResponse } from 'next/server';

export function proxy(req) {
  const basicAuth = req.headers.get('authorization');

  const adminUser = process.env.BASIC_AUTH_USER;
  const adminPass = process.env.BASIC_AUTH_PASSWORD;

  // Se não houver configuração de senha, permite o acesso (ex: ambiente de desenvolvimento local sem .env)
  if (!adminUser || !adminPass) {
    return NextResponse.next();
  }

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];
    const [user, pwd] = atob(authValue).split(':');

    if (user === adminUser && pwd === adminPass) {
      return NextResponse.next();
    }
  }

  return new NextResponse('Acesso Restrito', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Área Segura da Loja"',
    },
  });
}

export const config = {
  matcher: [
    /*
     * Aplica o proxy em todas as rotas, exceto:
     * - _next/static (arquivos estáticos)
     * - _next/image (arquivos de imagem otimizada)
     * - favicon.ico (ícone)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
