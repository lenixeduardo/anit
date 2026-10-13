# Fase 3 — Logística e expedição

## Código preparado

- Cotação Melhor Envio já implementada na API `/api/shipping` com autenticação, preço calculado no servidor, prazos, endereço e expiração.
- Aceitar **uma ou mais** opções reais de frete. A regra anterior exigia duas cotações (PAC e SEDEX) e bloqueava CEPs atendidos apenas por uma.
- Diagnóstico administrativo `GET /api/shipping/readiness` que retorna somente indicadores booleanos de configuração — sem revelar tokens nem CEP de origem.
- Pedido mantém `shipping_address`, `shipping_details`, `tracking_code`, `shipped_at`, histórico e controles de transição.

## Fluxo operacional para finalizar

1. Validar `paid` com pagamento comprovado (não iniciar expedição de `pending`).
2. Preparar dados reais: peso, dimensões das embalagens, remetente, destinatário e modalidade selecionada.
3. Comprar etiqueta através do endpoint oficial Melhor Envio com chave de idempotência por pedido (ou trava equivalente persistida no banco). Implementar geração, persistência e consulta do ID remoto; **não** repetir compra em timeout sem antes reconciliar.
4. Persistir etiqueta e seu estado no banco, armazenando o documento em local protegido e autorizando somente administradores.
5. Exibir ação de impressão no painel; após postagem registrar tracking no pedido e então transicionar `paid → shipped`.
6. Tratar indisponibilidade de serviços, cancelamento antes da postagem, erro de compra e estorno de etiqueta sem alterar o status de pagamento.
7. Reconciliar eventos de rastreio assinados (quando suportado) ou através de consultas periódicas autenticadas. Registrar eventos idempotentemente.
8. Testar em sandbox e em produção com uma etiqueta real controlada, apenas após credenciais e autorização comercial.

## Preparação no ambiente

```dotenv
SHIPPING_ENABLED=false
MELHOR_ENVIO_SANDBOX=true
MELHOR_ENVIO_TOKEN=
MELHOR_ENVIO_USER_AGENT=
SHIPPING_ORIGIN_POSTAL_CODE=
SUPABASE_SERVICE_ROLE_KEY=
```

Nunca mover essas credenciais para o frontend. O endpoint readiness não valida conectividade. A integração atual **apenas cota frete**; contratação de etiquetas não está implementada.

## Verificações necessárias antes do merge

- [ ] `npm ci`, `npx tsc --noEmit`, `npm run build`.
- [ ] Testes de cotação com zero, uma e múltiplas opções; preços inválidos e CEP sem atendimento.
- [ ] Revisão das migrações e RLS no Supabase de homologação.
- [ ] Verificar que o diagnóstico só é acessível por administrador.
- [ ] Configurar o provedor e testar fretes reais.
- [ ] Implementar emissão, cancelamento e rastreamento de etiquetas.
