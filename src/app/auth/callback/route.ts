import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseConfig } from '@/lib/supabase-config';
import { safeAuthRedirect } from '@/lib/auth-redirect';

export async function GET(request: NextRequest) {
  const destination = safeAuthRedirect(request.nextUrl.searchParams.get('next'));
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.headers.set('Cache-Control', 'private, no-store');
  const client = createServerClient(supabaseConfig.url, supabaseConfig.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: cookies => cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
    },
  });
  const code = request.nextUrl.searchParams.get('code');
  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return response;
  }
  const failed = NextResponse.redirect(new URL('/login.html?error=confirmation', request.url));
  failed.headers.set('Cache-Control', 'private, no-store');
  response.cookies.getAll().forEach(cookie => failed.cookies.set(cookie));
  return failed;
}
