# ANIT — Impedimentos de lançamento em 14/10/2026

## Correções presentes nesta branch
- Recuperação do QR PIX pelo provedor na tela de pedidos em modo Mercado Pago.
- O webhook de pagamento aprovado suporta redelivery após pedido já enviado/entregue.
- Lint específico dos módulos de pagamentos passou a bloquear a CI.
- Painel esconde ação manual de marcar PIX como recebido quando há gateway automático.

## Falhas ainda impeditivas
- [ ] Homologar transação PIX em sandbox/produção com credenciais aprovadas e provedor apto à categoria comercial.
- [ ] Implementar e testar expiração/cancelamento/refund com conciliação e reversão de estoque em banco de testes.
- [ ] Cobrir criação concorrente, timeout após compra no PSP e falha entre gravação externa e banco local.
- [ ] Confirmar migrations e RLS em projeto Supabase dedicado à ANIT. **Não há projeto ANIT visível entre os projetos Supabase conectados**, portanto não se alterou nenhum banco.
- [ ] Testar E2E de checkout com navegador, pagamentos e pedidos, não apenas lint/build.
- [ ] Implementar etiquetas de envio e tracking automático, ou definir formalmente expedição manual para o MVP.
- [ ] Configurar envios de e-mail reais e templates, com provedor autorizado.
- [ ] Completar revisão jurídica das políticas, contatos do controlador e regras comerciais.
- [ ] Verificar integração e execução de build na branch final; só mesclar PR #6 quando os controles P0 forem comprovados.

**Não permitir deploy com PAYMENT_PROVIDER=mercadopago enquanto as homologações e migrações estiverem pendentes.**
