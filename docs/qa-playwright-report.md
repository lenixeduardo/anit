# Relatório de QA — ANIT

**Branch:** `fix/qa-playwright-lint`
**GitHub Actions:** https://github.com/lenixeduardo/anit/actions/runs/38507298511
**Resultado:** sucesso no commit `68f681114fe345d2479e76fd52da3385c161a74f`.

## Testes executados
- [x] `npm ci`.
- [x] `npm run lint` para todos os arquivos-fonte controlados pela configuração; bundle de autenticação gerado/minificado ignorado.
- [x] Regressão HMAC do webhook Mercado Pago.
- [x] Regressão transacional SQL de pagamentos, cancelamentos e estoque.
- [x] `npx tsc --noEmit`.
- [x] Checagem sintática dos scripts JavaScript críticos.
- [x] `npm run build` de produção.
- [x] Playwright Chromium real: 6 páginas públicas x 4 larguras (320, 390, 768, 1440).
- [x] Conferência automática de imagens quebradas já carregadas, erros JavaScript e scroll horizontal.
- [x] Cenários browser de checkout PIX: estados de erro, retry, geração e recuperação, idempotência e responsividade.
- [x] Cenários browser de frete: opções, seleção e recálculo com mocks.

## Evidências
Capturas de 390px e 1440px são artefatos da execução, `anit-browser-screenshots`. Disponíveis na página do GitHub Actions vinculada acima.

## Limitações
- Esta revisão verifica dimensões/overflow e carregamento de imagens, mas as capturas ainda precisam de avaliação editorial humana para aprovação pixel-perfect.
- Os testes simulam serviços externos: não validam webhook real, valores reais de frete, Supabase de produção, domínio, e-mails ou pagamento real.
- Os cenários não provam todas as combinações possíveis de navegação e campos; validação de formulário crítico segue amparada pelos fluxos automatizados do checkout.
- Corrigir o lint não é suficiente para certificação jurídica/comercial do catálogo.

## Arquivos alterados
- Corrigidas âncoras internas do Next.js e tratamento tipado de erros da API de produtos.
- Separado bundle JavaScript gerado e scripts Node CommonJS na configuração ESLint.
- Scripts de Playwright tornados portáveis, sem caminho local de Windows/Edge.
- Adicionado teste Chromium e upload automático de screenshots.
