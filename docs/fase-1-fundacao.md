# Fase 1 — Fundação técnica da ANIT

## Escopo implementado
- Identidade do painel administrativo e nome do pacote padronizados para ANIT.
- O fluxo de cadastro novo usa o nome padrão `Cliente ANIT`.
- A política de INSERT de perfis do instalador completo exige `auth.uid() = id` e `role = 'user'`, evitando a janela permissiva durante a execução.
- A política de proteção de `role` e `id` do perfil continua ativa por trigger.

## Qual SQL utilizar?
- **Projeto Supabase novo:** `supabase/setup-anit.sql` é o instalador de base consolidado. Não execute `public/supabase_schema.sql`: é um legado que inclui dados fictícios e catálogo antigo.
- **Projeto Supabase existente:** não reexecute o instalador completo nem as versões alternativas de checkout de maneira indiscriminada. Antes, inventarie `pg_policies`, `pg_proc`, versões de RPC `create_pix_order`, constraints e tabelas existentes.
- **Frete real habilitado:** confira `supabase/shipping-checkout.sql` e `docs/shipping.md`, com credenciais e medidas válidas, antes de ativar `SHIPPING_ENABLED=true`. As assinaturas de 3 e 4 parâmetros de `create_pix_order` não devem permanecer simultaneamente se causarem ambiguidade.
- **Administrador:** execute `scripts/create-admin.cjs` apenas com a chave `SUPABASE_SERVICE_ROLE_KEY` no servidor, conferindo o endereço da conta administradora antes da execução.

## Auditoria do banco remoto, antes de aplicar modificações

```sql
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('create_pix_order','update_order_status','protect_profile_identity')
ORDER BY 1,2;

SELECT table_name,column_name,data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('profiles','products','orders','order_items','shipping_quotes')
ORDER BY table_name,ordinal_position;
```

## Checklist para concluir a fase 1 no ambiente real
- [ ] Confirmar projeto Supabase de produção e obter acesso seguro, sem inserir credenciais no GitHub.
- [ ] Comparar schema remoto com `supabase/setup-anit.sql` e as migrações aplicáveis.
- [ ] Verificar RLS para usuário anônimo, cliente A, cliente B e administrador.
- [ ] Validar cadastro/edição/exclusão de produtos com conta administradora.
- [ ] Confirmar integridade de estoque, pedidos e permissões sob concorrência.
- [ ] Identificar dados fictícios já existentes antes de decidir remoção.
- [ ] Executar `npm ci`, `npm run lint`, `npm run build` e testes automatizados em CI.
- [ ] Realizar smoke test desktop/mobile do painel revisado.

**Limite desta entrega:** alterações foram realizadas no repositório; não houve execução das migrações no banco remoto nem verificação com credenciais de produção. A fase 1 só pode ser considerada concluída após validar o ambiente real.
