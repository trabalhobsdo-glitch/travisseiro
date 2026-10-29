/* Função serverless (Vercel) — checkout transparente com a HyperCash.
   As chaves ficam SÓ em variáveis de ambiente (Vercel), nunca no GitHub nem no navegador.
   Rotas (todas em /api/checkout):
     GET  ?config=1        -> chave PÚBLICA + parcelas (para tokenizar o cartão no navegador)
     GET  ?coupon=CODIGO   -> valida o cupom e devolve o percentual
     GET  ?status=<id>     -> status do pagamento (usado para acompanhar Pix e cartão)
     POST {method:'pix'|'credit_card', ...} -> cria a cobrança */
const net = require('net');

const BASE = 'https://api.hypercashbrasil.com.br';   // a HyperCash só tem ambiente de produção
const digits = s => String(s == null ? '' : s).replace(/\D/g, '');
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max || 255);
const fail = (res, status, error, extra) => res.status(status).json(Object.assign({ error }, extra || {}));

function cpfOk(s) {
  s = digits(s);
  if (s.length !== 11 || /^(\d)\1+$/.test(s)) return false;
  for (let t = 9; t < 11; t++) {
    let d = 0;
    for (let c = 0; c < t; c++) d += Number(s[c]) * (t + 1 - c);
    d = ((10 * d) % 11) % 10;
    if (Number(s[t]) !== d) return false;
  }
  return true;
}

/* A resposta da HyperCash pode vir "solta" ou dentro de { data: ... }. Aceitamos os dois. */
const unwrap = j => (j && typeof j === 'object' && j.data && typeof j.data === 'object') ? j.data : (j || {});
/* ---------- preços e cupom (SEMPRE decididos aqui no servidor) ---------- */
const int = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : d; };
const kitPrice = q => int(process.env['KIT_' + q + '_PRICE_CENTS'], { 1: 6990, 2: 10990, 3: 15990 }[q]);   // centavos (preço TOTAL do kit)
const COUPON_CODE = () => String(process.env.COUPON_CODE || 'SAUDE').trim().toUpperCase();
const COUPON_PCT = () => Math.min(90, int(process.env.COUPON_PERCENT, 10));
const couponOk = c => !!c && String(c).trim().toUpperCase() === COUPON_CODE();
const lower = v => String(v == null ? '' : v).toLowerCase();

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  const key = process.env.HYPER_SECRET_KEY;                 // chave SECRETA
  const pub = process.env.HYPER_PUBLIC_KEY || '';           // chave PÚBLICA
  const maxInst = Math.min(12, Math.max(1, parseInt(process.env.CARD_MAX_INSTALLMENTS || '3', 10) || 1));
  // Autenticação da HyperCash: Basic base64("x:CHAVE_SECRETA")
  const auth = {
    Authorization: 'Basic ' + Buffer.from('x:' + (key || '')).toString('base64'),
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  /* ---------- GET ---------- */
  if (req.method === 'GET') {
    const q = req.query || {};
    if (q.coupon !== undefined) {
      return res.status(200).json(couponOk(q.coupon) ? { valid: true, code: COUPON_CODE(), percent: COUPON_PCT() } : { valid: false });
    }
    if (q.config) {
      return res.status(200).json({ publicKey: pub, maxInstallments: maxInst });
    }
    /* Diagnóstico: abra /api/checkout?diag=1 no navegador. Nunca mostra a chave nem o saldo. */
    if (q.diag) {
      const out = {
        secretKeyConfigured: !!key,
        secretKeyLength: key ? key.length : 0,
        secretKeyHasSpacesOrQuotes: key ? /^\s|\s$|^["']|["']$/.test(key) : false,
        secretKeyLooksLikePublicKey: key ? /^pk_/i.test(key.trim()) : false,
        publicKeyConfigured: !!pub,
        publicKeyStartsWith_pk: /^pk_/i.test(pub)
      };
      if (!key) return res.status(200).json(out);
      try {
        const r = await fetch(BASE + '/api/user/wallet/balance', { headers: auth });
        out.walletBalanceStatus = r.status;     // 200 = chave OK | 401 = chave errada | 403 = sem permissão
        const j = await r.json().catch(() => ({}));
        if (!r.ok) out.walletBalanceMessage = str(j && j.message, 120);
      } catch (e) { out.walletBalanceStatus = 'sem_conexao'; }
      return res.status(200).json(out);
    }
    if (q.status) {
      if (!key) return fail(res, 500, 'not_configured');
      const id = String(q.status);
      if (!/^[0-9a-zA-Z-]{8,64}$/.test(id)) return fail(res, 400, 'invalid_id');
      try {
        const r = await fetch(BASE + '/api/user/transactions/' + encodeURIComponent(id), { headers: auth });
        const j = await r.json().catch(() => ({}));
        const d = unwrap(j);
        if (!r.ok || !d.status) {
          console.error('hyper_status_error', r.status, JSON.stringify(j).slice(0, 400));
          return fail(res, 502, 'gateway_error');
        }
        return res.status(200).json({ status: lower(d.status) });
      } catch (e) {
        console.error('hyper_status_failed', e && e.message);
        return fail(res, 502, 'gateway_unreachable');
      }
    }
    return fail(res, 400, 'bad_request');
  }

  if (req.method !== 'POST') return fail(res, 405, 'method_not_allowed');
  if (!key) return fail(res, 500, 'not_configured');

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  /* ---------- validações (o PREÇO nunca vem do navegador) ---------- */
  const method = body.method === 'credit_card' ? 'credit_card' : body.method === 'pix' ? 'pix' : null;
  if (!method) return fail(res, 400, 'invalid_method');

  const qty = Number(body.qty);                       // kit: 1, 2 ou 3 travesseiros
  if (![1, 2, 3].includes(qty)) return fail(res, 400, 'invalid_qty');
  if (body.ship !== undefined && body.ship !== 'pac' && body.ship !== 'sedex') return fail(res, 400, 'invalid_ship');
  const ship = body.ship === 'sedex' ? 'sedex' : 'pac';

  const b = body.buyer || {}, a = body.address || {};
  const name = str(b.name), email = str(b.email), cpf = digits(b.cpf), phone = digits(b.phone);
  if (name.split(/\s+/).length < 2 || name.length < 5) return fail(res, 400, 'invalid_buyer', { field: 'nome' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail(res, 400, 'invalid_buyer', { field: 'email' });
  if (!cpfOk(cpf)) return fail(res, 400, 'invalid_buyer', { field: 'cpf' });
  if (phone.length < 10 || phone.length > 11) return fail(res, 400, 'invalid_buyer', { field: 'tel' });
  const zip = digits(a.cep), street = str(a.street), number = str(a.number, 20), neighborhood = str(a.neighborhood),
        city = str(a.city), state = str(a.state, 2).toUpperCase(), complement = str(a.complement);
  if (zip.length !== 8) return fail(res, 400, 'invalid_address', { field: 'cep' });
  if (street.length < 2) return fail(res, 400, 'invalid_address', { field: 'rua' });
  if (!number) return fail(res, 400, 'invalid_address', { field: 'num' });
  if (neighborhood.length < 2) return fail(res, 400, 'invalid_address', { field: 'bairro' });
  if (city.length < 2) return fail(res, 400, 'invalid_address', { field: 'cidade' });
  if (!/^[A-Z]{2}$/.test(state)) return fail(res, 400, 'invalid_address', { field: 'uf' });

  const sedexPrice = int(process.env.SEDEX_PRICE_CENTS, 1290);                  // centavos
  const shipFee = ship === 'sedex' ? sedexPrice : 0;
  const kitTotal = kitPrice(qty);                                               // preço do kit, em centavos
  const useCoupon = couponOk(body.coupon);
  const discount = useCoupon ? Math.round(kitTotal * COUPON_PCT() / 100) : 0;
  const productsTotal = kitTotal - discount;                                    // já com cupom
  const amount = productsTotal + shipFee;                                       // total em centavos

  const ref = 'AV' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();

  const address = { street, streetNumber: number, zipCode: zip, neighborhood, city, state, country: 'br' };
  if (complement) address.complement = complement;

  const payload = {
    amount,
    paymentMethod: method === 'pix' ? 'PIX' : 'CREDIT_CARD',
    customer: {
      name, email, phone,
      document: { number: cpf, type: 'CPF' }
    },
    shipping: { fee: shipFee, address },
    items: [{
      // uma linha só, com o valor do kit já com desconto, para o total dos itens bater com o valor cobrado
      title: 'Travesseiro Cervical Auriva - Kit ' + qty + (qty > 1 ? ' unidades' : ' unidade'),
      unitPrice: productsTotal, quantity: 1, tangible: true,
      externalRef: (process.env.PRODUCT_SKU || 'auriva-travesseiro-cervical') + '-kit-' + qty
    }],
    traceable: true,
    metadata: { pedido_id: ref, frete: ship.toUpperCase(), kit: String(qty), cupom: useCoupon ? COUPON_CODE() : '', desconto_centavos: String(discount) }
  };

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  if (ip && net.isIP(ip)) payload.ip = ip;

  if (method === 'pix') {
    payload.pix = { expiresInDays: 1 };
  } else {
    const token = String(body.token || '');
    if (token.length < 10 || token.length > 4000) return fail(res, 400, 'invalid_token');
    const n = Number(body.installments || 1);
    if (!Number.isInteger(n) || n < 1 || n > maxInst) return fail(res, 400, 'invalid_installments');
    payload.card = { hash: token };      // token gerado no navegador pelo SDK (FastSoft.encrypt)
    payload.installments = n;
  }

  /* ---------- cria a cobrança na HyperCash ---------- */
  try {
    const r = await fetch(BASE + '/api/user/transactions', { method: 'POST', headers: auth, body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      // O corpo do erro vai para o log da Vercel (nunca para o cliente) — útil para diagnosticar.
      console.error('hyper_error', r.status, JSON.stringify(j).slice(0, 800));
      if (r.status === 400) return fail(res, 422, 'validation', { message: str((j && (Array.isArray(j.message) ? j.message[0] : j.message)) || '', 160) });
      if (r.status === 401 || r.status === 403) return fail(res, 502, 'gateway_auth');
      return fail(res, 502, 'gateway_error');
    }
    const d = unwrap(j);
    if (!d.id) { console.error('hyper_no_id', JSON.stringify(j).slice(0, 400)); return fail(res, 502, 'gateway_error'); }

    if (method === 'pix') {
      const p = d.pix || {};
      const qr = p.qrcode || p.qrCode || p.qr_code || '';
      if (!qr) { console.error('hyper_no_qr', JSON.stringify(j).slice(0, 400)); return fail(res, 502, 'gateway_error'); }
      return res.status(200).json({ ref, id: d.id, status: lower(d.status), qr_code: qr, expiration_date: p.expirationDate || null });
    }
    return res.status(200).json({ ref, id: d.id, status: lower(d.status), refused_reason: d.refusedReason ? str(d.refusedReason, 120) : null });
  } catch (e) {
    console.error('hyper_fetch_failed', e && e.message);
    return fail(res, 502, 'gateway_unreachable');
  }
};
