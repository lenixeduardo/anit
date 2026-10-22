# Mercado Pago Pix — checklist de ativação

## Implementação existente

- `POST /api/orders`: cria pedido autenticado via RPC `create_pix_order`.
- `POST /api/payments/mercadopago`: cria cobrança Pix usando valor do pedido persistido no servidor, CPF e chave de idempotência.
- `GET /api/payments/mercadopago?orderId=...`: recupera cobrança vinculada ao usuário.
- `POST /api/webhooks/mercadopago?data.id=<id>`: valida assinatura HMAC, consulta pagamento diretamente ao Mercado Pago e concilia via RPC.

## Configuração Vercel (somente servidor, exceto chave pública)

- `PAYMENT_PROVIDER=mercadopago` (habilitar apenas após todos os pré-requisitos)
- `MERCADOPAGO_ACCESS_TOKEN` (sensitive, não usar NEXT_PUBLIC)
- `MERCADOPAGO_WEBHOOK_SECRET` (sensitive, gerado no painel Mercado Pago > Webhooks)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ou `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (sensitive, exclusivamente servidor)
- `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY` (opcional para este checkout Pix via API)
- `MERCADO_PAGO_CLIENT_ID` (identificador, opcional para Pix via API)

**Atenção:** as rotas usam Supabase, mesmo que o projeto Vercel tenha variáveis Turso. Não habilitar `PAYMENT_PROVIDER` antes de confirmar qual banco de pedidos é o de produção.

## Banco de dados

Verificar a tabela `payment_transactions` com unicidade de `order_id` + `provider` e as RPCs `confirm_provider_pix_payment` e `cancel_provider_pix_payment`. As RPCs precisam validar ID da cobrança, referência externa, valor, estado anterior e garantir atualização idempotente do pedido e estoque.

## Webhook

Cadastrar URL HTTPS de produção: `https://<dominio-da-loja>/api/webhooks/mercadopago`.
Habilitar evento **Pagamentos**. Copiar a chave secreta de assinatura para `MERCADOPAGO_WEBHOOK_SECRET`, sem incluí-la no repositório. Não usar o Client Secret OAuth como segredo de webhook.

## Testes antes de ativar

1. Build e testes automatizados no preview sem segredos reais.
2. Checkout autenticado: carrinho, endereço, cálculo de frete, CPF válido.
3. Criar cobrança de teste e verificar Pix copia e cola e QR.
4. Testar assinatura inválida (401) e notificação assinada válida.
5. Validar transição pending → paid **somente** após consulta ao provedor.
6. Repetir webhook e confirmar ausência de duplicação de pagamento/estoque.
7. Testar cobrança rejeitada/cancelada e expirada.
8. Confirmar pedido de outro usuário bloqueado (401/409).
9. Revisar logs sem exposição de CPF, token ou QR.
10. Somente depois ativar `PAYMENT_PROVIDER=mercadopago` e publicar novo deployment.

## Segurança

Credenciais mostradas em capturas devem ser rotacionadas no Mercado Pago. Não executar transações reais com token exposto.