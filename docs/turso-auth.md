# Autenticação própria via Turso — implementação inicial

A API `/api/auth/local` foi implementada, mas **não está conectada ao login atual da vitrine**. A autenticação Supabase permanece ativa no frontend e nas APIs antigas.

## Configuração do servidor
```env
TURSO_DATABASE_URL=libsql://seu-banco.turso.io
TURSO_AUTH_TOKEN=token-do-banco
```
Não usar NEXT_PUBLIC_ nas credenciais. O banco precisa permitir criação de tabelas.

## Endpoints
- `POST /api/auth/local` com `{"action":"register","name":"Ana","email":"ana@example.com","password":"senha-forte-com-12-ou-mais-caracteres","termsAccepted":true}`
- `POST /api/auth/local` com `{"action":"login","email":"ana@example.com","password":"..."}`
- `GET /api/auth/local` retorna `{user}` (nulo para visitante)
- `POST /api/auth/local` com `{"action":"logout"}`

O browser envia cookies automaticamente em chamadas same-origin. Requisições POST exigem `Origin` igual à origem do servidor. Sessões são tokens aleatórios e apenas o SHA-256 do token é armazenado. Cookie HttpOnly, SameSite=Lax, Secure em produção e prazo de sete dias. Senhas usam scrypt com salt aleatório, não são salvas em texto puro. A API limita tentativas de login por email.

## Limites atuais — NÃO publicar como substituição de Supabase Auth
- Ainda não há integração com `public/auth-client.js` e com as rotas de perfil, produtos administrativos, checkout e frete.
- As APIs antigas continuam exigindo bearer tokens Supabase. Uma sessão Turso, isoladamente, **não dá acesso a elas**.
- Ainda faltam confirmação de email, recuperação/reset de senha, mecanismos de limpeza de sessões/tentativas expiradas e rate limiting por IP/dispositivo.
- O banco Turso precisa receber os usuários existentes por migração autorizada; não há portabilidade automática de senhas Supabase.
- Atualizar `package-lock.json` com `npm install`; executar typecheck, lint e testes integrados antes de merge. Nenhuma dessas validações foi executada neste ambiente.
- A implementação de pedidos da PR #10 ainda usa better-sqlite3 local; migrar todo o backend para `@libsql/client` antes do uso na Vercel.
