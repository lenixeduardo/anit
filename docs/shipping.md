# Integração de frete

Adaptador Melhor Envio preparado para os serviços 1 e 2 (PAC e SEDEX). A disponibilidade depende dos itens e do destino: o checkout só libera a seleção quando há pelo menos duas cotações válidas. Não cria opções fictícias quando o provedor não atende o destino.

## Ativação

1. Aplicar supabase/shipping-checkout.sql depois de setup-anit.sql e order-management.sql. A migração substitui o checkout de tarifa fixa; publicar a API e o frontend juntos.
2. Configurar no servidor SUPABASE_SERVICE_ROLE_KEY, MELHOR_ENVIO_TOKEN, MELHOR_ENVIO_USER_AGENT (nome da aplicação e email de suporte) e SHIPPING_ORIGIN_POSTAL_CODE (8 dígitos).
3. No painel admin.html, cadastrar medidas reais dos produtos embalados: weight_kg, height_cm, width_cm e length_cm. Valores ausentes impedem cotação; nenhuma medida é estimada automaticamente.
4. MELHOR_ENVIO_SANDBOX=true consulta homologação e bloqueia criação de Pix com essas cotações. Para operação real usar false e credenciais de produção.
5. Validar dois serviços reais para CEPs atendidos antes de publicar. Esta alteração não compra etiquetas nem agenda coleta.

O servidor consulta preços, estoque e medidas do catálogo e guarda cotações por cliente durante 15 minutos. O banco preserva o endereço cadastrado no pedido e exige que seu CEP corresponda à cotação. Valida propriedade, validade e itens/quantidades antes de usar o preço de frete no pedido. O cliente envia apenas o identificador da cotação. A alteração de CEP invalida seleção e total; alteração de carrinho exige nova consulta. A tarifa fixa de R$ 18,90 e o frete grátis automático foram removidos do resumo.

As cópias de código em anit-repo e anit-sites foram sincronizadas. Configurar também as variáveis no ambiente de hospedagem de anit-sites.

O painel permite cadastrar e editar as quatro medidas juntas, em kg e cm, com valores positivos. Não preenche medidas fictícias. A consulta ao ambiente de produção do Sites confirmou que somente as variáveis públicas do Supabase estão cadastradas; as credenciais de frete também faltam na hospedagem.

## Validação local

- node scripts/test-shipping-admin.cjs: cadastro completo, persistência numérica, edição e rejeição de medidas inválidas.
- node scripts/test-shipping-db.cjs: PAC, SEDEX, total, persistência, carrinho diferente, permissões, idempotência e fluxo de pedido em PostgreSQL isolado.
- node scripts/test-shipping-ui.cjs: dois serviços simulados, troca de seleção/total, invalidação por CEP, envio da cotação ao pedido e responsividade em quatro larguras.
- node node_modules/typescript/bin/tsc --noEmit.

Testes usam dados simulados. Não comprovam atendimento real das transportadoras. As credenciais de frete, CEP de origem, chave administrativa e medidas não estavam configurados no ambiente inspecionado; migração não foi executada no banco remoto e o site não foi publicado.

Referência: https://docs.melhorenvio.com.br/reference/calculo-de-fretes-por-produtos


## Endereço obrigatório e ativação gradual

A correção de endereço usa shipping-address.sql (RPC de 3 argumentos) e shipping-metadata.sql. O perfil e o checkout exigem endereço completo salvo, e orders.shipping_address mantém uma cópia imutável. As telas de pedidos exibem essa cópia. Pedidos antigos permanecem no histórico; Pix sem endereço não pode ser reemitido.

A cotação externa permanece desativada enquanto SHIPPING_ENABLED não for true, preservando a tarifa atual (R$ 18,90 abaixo de R$ 200). Para ativar, configure credenciais e medidas, aplique shipping-checkout.sql (RPC de 4 argumentos) e só então defina SHIPPING_ENABLED=true na hospedagem. A página consulta /api/config para exibir as opções; usa o CEP do endereço salvo e invalida a cotação ao editar os dados. Para voltar à tarifa fixa, desative o flag e reaplique shipping-address.sql, removendo a assinatura de quatro argumentos para evitar ambiguidade no PostgREST.
