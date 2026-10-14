# ANIT — Critérios de lançamento (Fase 6)

## Impedimentos para produção
Não lançar nem ativar pagamentos automáticos enquanto houver verificações críticas falhando.

### Engenharia
- [ ] `npm ci`, TypeScript, lint e build aprovados.
- [ ] Testes do fluxo de cadastro, autenticação, catálogo, carrinho e compra.
- [ ] Testes de webhook assinado: repetição, fora de ordem, pagamento divergente, estoque insuficiente e falha de rede.
- [ ] Validar o checkout PIX dinâmico em vez do QR estático quando o gateway estiver ativo.
- [ ] Validar migrations, RLS e banco de homologação antes de aplicação em produção.
- [ ] Testar rotas administrativas contra acesso anônimo e clientes comuns.

### UX
- [ ] Validar larguras 320, 390, 768 e 1440px, sem overflow.
- [ ] Conferir estados de carregamento/erro, imagens de produtos, botões e acessibilidade.
- [ ] Validar endereço, frete com uma opção, pedidos, rastreamento e cancelamentos.

### Operação
- [ ] Configurar provedor de frete e dados reais dos produtos.
- [ ] Preparar envio de e-mails e suporte com canal oficial.
- [ ] Aprovar FAQ, LGPD, política de devolução e informações empresariais.
- [ ] Validar legalidade e elegibilidade do catálogo junto a parceiros de pagamento e logística.

### Publicação
- [ ] Revisar sequência de PRs 1→2→3→4→5 e conflitos.
- [ ] Habilitar monitoramento de exceções, logs sem dados sensíveis e rollback.
- [ ] Fazer compra controlada e conciliar o recebimento e a expedição.

## Escopo dessa PR
Automatiza checagens de sintaxe das páginas JavaScript e acompanha falhas do pipeline de build. Não implica aprovação dos requisitos acima nem configura provedores externos.
