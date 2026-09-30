# Autenticação ANIT

O cliente local `public/auth-client.js` usa `@supabase/ssr` e compartilha cookies com o Next.js. É gerado por `scripts/build-auth.cjs` antes de `dev` e `build`. Usuários com sessões antigas em localStorage precisam entrar novamente.

`src/proxy.ts` valida a sessão com `getUser()` antes de entregar perfil, checkout, pedidos, confirmação de compra e páginas administrativas. Admin exige `profiles.role = 'admin'` consultado no banco. Respostas privadas usam `Cache-Control: private, no-store`. Os endpoints de pedidos continuam validando seus tokens Bearer e permissões independentemente do Proxy.

## Configuração no Supabase

- Defina a URL do site em Authentication > URL Configuration.
- Autorize `http://localhost:3000/auth/callback` e a URL equivalente do domínio de produção.
- Ative Email e, se desejado, configure o provedor Google com suas credenciais.
- Mantenha a confirmação de e-mail conforme a política da loja; o cadastro sem sessão aguarda confirmação.
- Configure os templates de confirmação e recuperação para usar `{{ .ConfirmationURL }}`. O callback troca o código PKCE por uma sessão.
- Configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (ou a chave anon legada). Chaves administrativas ficam apenas no servidor.

Proteção de páginas não substitui RLS. Revise as políticas de `profiles`, `orders` e `order_items` e o bloqueio de alterações de `profiles.role` antes de produção. A conexão do plugin é necessária para verificar as políticas e configurações do projeto remoto; estes passos não foram aplicados automaticamente pelo código.
