# Fase 2 — Pagamentos ANIT (integração em homologação)

## Implementado na branch
- `POST /api/payments/mercadopago`: criação de cobrança PIX a partir de pedido autenticado; consulta valor no banco, usa chave de idempotência por pedido e não recebe preços do browser.
- `POST /api/webhooks/mercadopago`: valida assinatura HMAC do Mercado Pago e consulta o pagamento diretamente no provedor.
- `supabase/payment-reconciliation.sql`: registro de transações e confirmação atômica, idempotente, com débito de estoque e histórico.
- Bloqueio de confirmação manual `paid` quando `PAYMENT_PROVIDER=mercadopago`.

## Não ativar em produção ainda
**A integração não está conectada ao frontend do checkout nesta etapa.** O checkout atual continua emitindo QR Code PIX estático; a API de cobrança Mercado Pago existe separadamente. Não anuncie confirmação automática como funcional até conectar a UI e concluir testes. Não habilite `PAYMENT_PROVIDER` antes de aplicar a migração e preparar o fluxo no frontend.

O provedor Mercado Pago foi escolhido como adaptador inicial, sujeito à aprovação da conta comercial e à elegibilidade do catálogo da ANIT. Não armazenar CPF no banco ou em logs. Não expor token nem segredo no navegador.

## Variáveis de servidor (não commitar valores)
```dotenv
# Ativar somente depois de concluir integração, validar dados reais e migrar o banco
PAYMENT_PROVIDER=mercadopago
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=
SUPABASE_SERVICE_ROLE_KEY=
```

Webhook pretendido: `https://SEU-DOMINIO/api/webhooks/mercadopago`. Verificar que o provedor enviará `data.id` na query e `x-request-id` e `x-signature` nos headers. O validador exige timestamp dentro de cinco minutos.

## Pendências obrigatórias
- [ ] Obter aprovação do provedor e credenciais sandbox/produção.
- [ ] Conectar o checkout para coletar CPF com transparência e sem persistência indevida, invocar a nova API e exibir exclusivamente o QR do PSP.
- [ ] Impedir que pedidos vinculados a PSP recebam QR estático por endpoints antigos.
- [ ] Implementar recuperação de cobrança idempotente, incluindo falha entre criar no PSP e registrar no banco.
- [ ] Tratar notificação recebida antes do registro do pagamento (reconciliador).
- [ ] Construir gestão de expiração, cancelamento, reembolso e divergências de estoque.
- [ ] Validar RLS, testes de concorrência, duplicação e webhook adulterado em PostgreSQL isolado.
- [ ] Executar lint, build e E2E e teste real controlado em sandbox/produção, conforme regras do provedor.
