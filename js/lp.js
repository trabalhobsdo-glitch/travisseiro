/* Auriva — comportamento da landing page: kits, cupom SAUDE e botão que leva ao checkout. */
(function () {
  const C = window.CONFIG;
  const $ = id => document.getElementById(id);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const brl = cents => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const kitCents = q => Math.round(C.kits[q] * 100);
  const discountCents = q => Math.round(kitCents(q) * C.cupom.percentual / 100);   // mesma conta do servidor

  /* aparecer ao rolar */
  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
    }), { threshold: .1 });
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
  }

  /* kits + cupom */
  const kits = [...document.querySelectorAll('.kit')];
  let qty = 1, coupon = false;

  function render() {
    const base = kitCents(qty), final = base - (coupon ? discountCents(qty) : 0);
    $('qty').textContent = qty + ' travesseiro' + (qty > 1 ? 's' : '');
    $('total').textContent = brl(final);
    $('sticky-price').textContent = brl(final);
    $('sticky-info').textContent = (coupon ? 'Com cupom ' + C.cupom.codigo + ' • ' : 'A partir de • ') + qty + (qty > 1 ? ' unidades' : ' unidade');
    const st = $('coupon-status'), btn = $('apply-coupon');
    st.textContent = coupon
      ? 'Cupom ' + C.cupom.codigo + ' aplicado: você economiza ' + brl(base - final) + ' neste kit.'
      : 'Ative o cupom ' + C.cupom.codigo + ' para reduzir o total em ' + C.cupom.percentual + '%.';
    st.classList.toggle('active', coupon);
    btn.textContent = coupon ? '✓ CUPOM APLICADO' : 'APLICAR ' + C.cupom.percentual + '% OFF';
    btn.setAttribute('aria-pressed', String(coupon));
  }

  kits.forEach(k => k.addEventListener('click', () => {
    kits.forEach(x => { x.classList.remove('selected'); x.setAttribute('aria-pressed', 'false'); });
    k.classList.add('selected'); k.setAttribute('aria-pressed', 'true');
    qty = Number(k.dataset.qty);
    render();
    if (!reduced) { const t = $('total'); t.classList.remove('price-pop'); void t.offsetWidth; t.classList.add('price-pop'); }
  }));
  $('apply-coupon').addEventListener('click', () => { coupon = !coupon; render(); });
  render();

  /* COMPRAR → checkout */
  $('checkout').addEventListener('click', () => {
    try { localStorage.setItem('auriva_pedido', JSON.stringify({ qty, coupon: coupon ? C.cupom.codigo : '' })); } catch (e) {}
    const q = new URLSearchParams({ kit: qty });
    if (coupon) q.set('cupom', C.cupom.codigo);
    location.href = 'checkout.html?' + q.toString();     // os parâmetros garantem que funcione mesmo sem localStorage
  });

  /* cards surgindo de leve */
  if (!reduced && 'IntersectionObserver' in window) {
    const alvos = document.querySelectorAll('.detailcard,.benefitgrid > div');
    const o = new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting) {
        en.target.style.transition = 'opacity .55s ease, transform .55s ease, box-shadow .3s ease';
        en.target.style.opacity = '1'; en.target.style.transform = 'translateY(0)'; o.unobserve(en.target);
      }
    }), { threshold: .08 });
    alvos.forEach(el => { el.style.opacity = '.99'; el.style.transform = 'translateY(8px)'; o.observe(el); });
  }
})();
