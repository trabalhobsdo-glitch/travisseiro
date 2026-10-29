/* TikTok Pixel — ViewContent (página do produto) e InitiateCheckout (checkout). Carregar DEPOIS de config.js. */
!function (w, d, t) {
  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(
var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script")
;n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};

  ttq.load('DBFSIR3C77U4SEFNNPSG');
  ttq.page();

  try {
    var C = w.CONFIG || {}, nome = C.produto || 'Travesseiro Cervical Auriva';
    if (/checkout/i.test(location.pathname)) {
      var k = parseInt(new URLSearchParams(location.search).get('kit'), 10);
      if (!(C.kits && C.kits[k])) k = 1;
      ttq.track('InitiateCheckout', {
        contents: [{ content_id: 'kit-' + k, content_type: 'product', content_name: nome, quantity: k }],
        content_type: 'product',
        quantity: k,
        value: C.kits ? C.kits[k] : undefined,
        currency: 'BRL'
      });
    } else {
      ttq.track('ViewContent', {
        contents: [{ content_id: 'travesseiro', content_type: 'product', content_name: nome }],
        content_type: 'product',
        value: C.kits ? C.kits[1] : undefined,
        currency: 'BRL'
      });
    }
  } catch (e) {}
}(window, document, 'ttq');
