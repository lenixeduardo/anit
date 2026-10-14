# ANIT — TODO de conclusão

## Fase 1 — Estrutura e banco
- [x] Preparar ajustes de identidade ANIT e políticas de criação de perfis na PR #1.
- [ ] Aprovar e integrar PR #1.
- [ ] Validar migrações e RLS no Supabase real; testar CRUD, estoque e permissões.
- [ ] Executar verificações da fase 1 no ambiente de homologação.

## Fase 2 — Pagamentos PIX (PR #2)
- [x] Preparar APIs de criação e recuperação de cobrança PIX Mercado Pago.
- [x] Preparar webhook assinado e função transacional de baixa de estoque.
- [x] Integrar frontend e desabilitar PIX estático quando gateway automático estiver ativo.
- [x] Corrigir versão de dependência Supabase incompatível; regenerar lockfile.
- [ ] Corrigir falhas de ESLint, especialmente tipagens novas e problemas legados que bloqueiam a CI.
- [ ] Aprovar TypeScript e build de produção.
- [ ] Implementar expiração de cobrança e pedido, cancelamento seguro e política de reembolso.
- [ ] Cobrir idempotência, falhas de rede, eventos fora de ordem e pagamentos concorrentes com testes automatizados.
- [ ] Validar SQL de conciliação em PostgreSQL de homologação; não executar sem auditoria do ambiente.
- [ ] Revisar fluxo do CPF e de pagamento nas telas de pedidos.
- [ ] Resolver eventuais divergências entre PR #1, #2 e #3 antes dos merges.
- [ ] Configurar credenciais Mercado Pago, autorização do estabelecimento, webhook e testar transação real controlada. **Dependência externa adiada a pedido.**

## Fase 3 — Frete e entregas (PR #3)
- [x] Cotação integrada ao Melhor Envio (existente antes da fase 3).
- [x] Guardar cotação e endereço no pedido (existente).
- [ ] Verificar credenciais de frete e CEP de origem no ambiente de deploy.
- [ ] Aplicar migrações de logística após inventário das versões de RPC.
- [ ] Cadastrar peso, dimensões e medidas das embalagens reais.
- [ ] Validar CEPs reais, prazos, indisponibilidade e o fluxo de checkout.
- [ ] Implementar compra de etiquetas após confirmação de pagamento, com idempotência.
- [ ] Vincular etiqueta, tracking e estado logístico ao pedido.
- [ ] Testar impressão, cancelamento de etiquetas e atualizações de rastreio.
- [ ] Executar testes isolados e homologação sem modificar pedidos reais.

## Fases 4–6
- [x] Fase 4: estrutura existente de CRUD e gestão de pedidos revisada em código.
- [ ] Fase 4: validar RLS, testar CRUD e adaptar confirmação de pagamento na tela administrativa.
- [x] Fase 5: página inicial de FAQ criada.
- [ ] Fase 5: e-mails transacionais, políticas definitivas e canal de atendimento.
- [x] Fase 6: preparar CI de validação de TypeScript, build e sintaxe das páginas JS.
- [ ] Fase 6: eliminar erros de TypeScript, lint e build detectados pela CI.
- [ ] Fase 6: executar testes E2E portáveis (script PIX atual depende de caminho absoluto do Playwright no Windows).
- [ ] Fase 6: validar responsividade 320/390/768/1440, imagens e acessibilidade em navegador real.
- [ ] Fase 6: auditar integração de pagamentos, estoque, frete, e-mails e políticas antes de ativar produção.
- [ ] Fase 6: checar dependências das PRs #1–#4, promover merges sequenciais e resolver conflitos.
- [ ] Fase 6: executar migrações seguras em homologação e testar dados reais autorizados.
- [ ] Fase 6: publicar somente após critérios de aprovação e configurar monitoramento/alertas.

**Observação:** itens implementados em branch não são funcionalidades validadas em produção. PRs ainda precisam de revisão e integração.
