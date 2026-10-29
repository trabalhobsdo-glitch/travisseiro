AURIVA — Página do produto + checkout transparente HyperCash (Pix e cartão dentro do site)

ESTRUTURA
  index.html        página do produto (landing page) com os kits de 1, 2 e 3 travesseiros e o cupom SAUDE
  checkout.html     checkout completo: frete, dados, endereço e pagamento (Pix / cartão)
  api/checkout.js   função do servidor (Vercel): cria a cobrança na HyperCash, valida cupom e consulta status
  css/lp.css        estilos da página do produto
  css/checkout.css  estilos do checkout
  js/config.js      preços e textos EXIBIDOS na vitrine (kits, cupom, SEDEX, prazos, WhatsApp)
  js/lp.js          lógica da página do produto (escolha do kit, cupom, botão "Quero garantir meu kit")
  js/pedido.js      lógica do checkout (CEP, validação, Pix, cartão, 3D Secure, acompanhamento do pagamento)
  js/icons.js       ícones
  images/           logo, favicon e fotos do produto (produto-5, -7 e -8 são usadas na página; produto-8 também no resumo do checkout)
  vercel.json       região da função (gru1 = São Paulo)

COMO SUBIR
  1. Suba esta pasta inteira no GitHub (a pasta api/ precisa ir junto).
  2. Na Vercel: Add New > Project > importe o repositório. Framework: "Other". Não precisa de build.
  3. Em Settings > Environment Variables, crie as variáveis abaixo e faça Redeploy.

VARIÁVEIS NA VERCEL
  HYPER_SECRET_KEY       chave SECRETA da HyperCash (painel HyperCash > API / Integrações)
  HYPER_PUBLIC_KEY       chave PÚBLICA da HyperCash (começa com pk_live_...)
  KIT_1_PRICE_CENTS      6990    (R$ 69,90 — preço TOTAL do kit de 1, em centavos)   [opcional: já é o padrão]
  KIT_2_PRICE_CENTS      10990   (R$ 109,90)                                          [opcional]
  KIT_3_PRICE_CENTS      15990   (R$ 159,90)                                          [opcional]
  COUPON_CODE            SAUDE                                                        [opcional]
  COUPON_PERCENT         10                                                           [opcional]
  SEDEX_PRICE_CENTS      1290    (frete SEDEX; o PAC é grátis)                        [opcional]
  CARD_MAX_INSTALLMENTS  3       (máximo de parcelas no cartão)                       [opcional]

DIAGNÓSTICO
  Abra  https://SEU-SITE.vercel.app/api/checkout?diag=1  para ver se as chaves estão certas
  (nunca mostra a chave nem o saldo). Se algo falhar, veja Vercel > projeto > Logs: a resposta
  de erro da HyperCash aparece lá (linhas "hyper_error ...").

TESTES
  A HyperCash só tem ambiente de PRODUÇÃO (não existe sandbox). Para testar sem gastar:
  coloque KIT_1_PRICE_CENTS=500 (R$ 5,00), faça Redeploy, pague um Pix de verdade e confira no painel
  da HyperCash. Depois apague a variável (volta ao padrão) e faça Redeploy de novo.

IMPORTANTE
  - A chave secreta NUNCA vai no GitHub nem no navegador, só na Vercel.
  - O valor cobrado vem SEMPRE do servidor (preço do kit, cupom e frete). O navegador só envia
    "qual kit" (1, 2 ou 3), o código do cupom e o tipo de frete.
  - Se mudar preço ou cupom: mude na Vercel E em js/config.js (que só exibe) E nos botões de kit do
    index.html (data-price e textos) para a página não ficar diferente do que é cobrado.
  - O GitHub Pages NÃO serve: ele não roda a pasta api/. Use a Vercel.
  - Pedidos, endereços e status aparecem no painel da HyperCash.
