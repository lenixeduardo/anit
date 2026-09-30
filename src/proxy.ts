import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseConfig } from '@/lib/supabase-config';

export async function proxy(request: NextRequest) {
  // Static files are case insensitive on Windows; normalize before authorization.
  let pathname: string;
  try { pathname = decodeURIComponent(request.nextUrl.pathname).toLowerCase(); }
  catch { return new NextResponse('Endereço inválido.', { status: 400 }); }
  const protectedPages = new Set(['/perfil.html', '/checkout.html', '/pedidos.html', '/admin.html', '/admin-pedidos.html', '/compra-confirmada.html']);
  if (!protectedPages.has(pathname)) return NextResponse.next();
  let response = NextResponse.next({ request });
  const client = createServerClient(supabaseConfig.url, supabaseConfig.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies) {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  function finish(result: NextResponse) {
    response.cookies.getAll().forEach(cookie => result.cookies.set(cookie));
    result.headers.set('Cache-Control', 'private, no-store');
    return result;
  }
  try {
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user || user.is_anonymous) {
      const url = new URL('/login.html', request.url);
      url.searchParams.set('next', pathname + request.nextUrl.search);
      return finish(NextResponse.redirect(url));
    }
    if (pathname.startsWith('/admin')) {
      const { data: profile, error: roleError } = await client.from('profiles').select('role').eq('id', user.id).single();
      if (roleError || profile?.role !== 'admin') {
        return finish(new NextResponse('Acesso restrito ao administrador.', { status: 403 }));
      }
    }
    return finish(response);
  } catch {
    return finish(new NextResponse('Não foi possível validar sua sessão. Tente novamente.', { status: 503 }));
  }
}

export const config = {
  matcher: ['/:path*'],
};
