/* ========= CONFIGURAÇÕES DA VITRINE — edite aqui =========
   Estes valores servem só para EXIBIR. O valor cobrado vem SEMPRE do servidor (api/checkout.js + variáveis da Vercel). */
window.CONFIG = {
  produto: "Travesseiro Cervical Auriva",
  precoAntigo: 199.90,          // preço "De" riscado do kit de 1 unidade
  kits: {                       // preço TOTAL de cada kit (R$)
    1: 69.90,
    2: 109.90,
    3: 159.90
  },
  cupom: { codigo: "SAUDE", percentual: 10 },
  parcelasSemJuros: 3,          // 1 = esconde o parcelamento. Confirme com a HyperCash.
  sedexPreco: 12.90,            // frete SEDEX (o PAC é grátis)
  prazoPac: "",                 // ex.: "5 a 12 dias úteis" (vazio = não mostra)
  prazoSedex: "",               // ex.: "2 a 5 dias úteis"
  whatsapp: ""                  // ex.: "5531999999999" (vazio = esconde o botão)
};
