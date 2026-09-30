const destinations = new Set([
  '/perfil.html', '/checkout.html', '/pedidos.html',
  '/admin.html', '/admin-pedidos.html', '/compra-confirmada.html',
  '/reset-password.html',
]);

export function safeAuthRedirect(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/perfil.html';
  const url = new URL(value, 'https://anit.invalid');
  return destinations.has(url.pathname) && url.origin === 'https://anit.invalid'
    ? url.pathname + url.search : '/perfil.html';
}
