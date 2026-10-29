(function(){
const C=window.CONFIG,$=id=>document.getElementById(id);
/* Todos os valores em CENTAVOS (inteiros), igual ao servidor. */
const brl=c=>(c/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const kitCents=q=>Math.round(C.kits[q]*100),sedexCents=Math.round(C.sedexPreco*100);
let qty=1,ship='pac',cepOk=false,method='pix',busy=false,coupon='',couponPct=0;
let cfg=null,sdkReady=null,pollTimer=null,lastRef='';

/* kit e cupom vêm da página do produto (?kit=2&cupom=SAUDE ou localStorage) */
try{
  const p=new URLSearchParams(location.search),st=JSON.parse(localStorage.getItem('auriva_pedido')||'{}');
  const k=parseInt(p.get('kit')||st.qty,10);if(C.kits[k])qty=k;
  coupon=String(p.get('cupom')||st.coupon||'').trim().toUpperCase();
}catch(e){}
$('pnome').textContent=C.produto;
$('sedexPreco').textContent=brl(sedexCents);
if(C.prazoPac)$('pacTxt').textContent='Entrega em '+C.prazoPac;
if(C.prazoSedex)$('sedexTxt').textContent='Entrega em '+C.prazoSedex;

/* ---------- totais ---------- */
const discount=()=>coupon&&couponPct?Math.round(kitCents(qty)*couponPct/100):0;   // mesma conta do servidor
const shipCents=()=>ship==='sedex'?sedexCents:0;
const total=()=>kitCents(qty)-discount()+shipCents();
function maxInst(){return cfg&&cfg.maxInstallments>1?cfg.maxInstallments:1}
function fillParc(){
  const sel=$('parcSel'),n=maxInst(),t=total(),cur=sel.value||'1';
  $('parcWrap').hidden=n<2;sel.innerHTML='';
  for(let i=1;i<=n;i++){const o=document.createElement('option');o.value=i;o.textContent=i+'x de '+brl(Math.ceil(t/i))+(i>1?' sem juros':'');sel.append(o)}
  sel.value=Math.min(Number(cur),n);
}
function btnTxt(){$('finTxt').textContent=method==='pix'?'Gerar Pix · '+brl(total()):'Pagar '+brl(total())+' no cartão'}
function show(){
  const f=shipCents(),base=kitCents(qty),d=discount();
  $('rc').textContent=qty;
  [1,2,3].forEach(k=>{$('k'+k).textContent=brl(kitCents(k))});
  document.querySelectorAll('input[name=kit]').forEach(r=>r.checked=Number(r.value)===qty);
  $('resumo').textContent='Produtos ('+qty+(qty>1?' unidades':' unidade')+')';$('sub').textContent=brl(base);
  $('descRow').hidden=!d;if(d){$('descNome').textContent='Cupom '+coupon;$('descVal').textContent='− '+brl(d)}
  $('fnome').textContent='Frete '+ship.toUpperCase();
  const fv=$('fval');fv.textContent=f?brl(f):'Grátis';fv.className=f?'':'ok';
  $('tot').textContent=brl(total());
  $('parc').textContent=C.parcelasSemJuros>1?'ou em até '+C.parcelasSemJuros+'x de '+brl(Math.ceil(total()/C.parcelasSemJuros))+' sem juros no cartão':'';
  try{localStorage.setItem('auriva_pedido',JSON.stringify({qty,coupon}))}catch(e){}
  btnTxt();fillParc();
}
show();
document.querySelectorAll('input[name=kit]').forEach(r=>r.onchange=()=>{qty=Number(r.value);show()});
document.querySelectorAll('input[name=frete]').forEach(r=>r.onchange=()=>{ship=r.value;show()});
if(C.whatsapp){const w=$('wa');w.hidden=false;w.href='https://wa.me/'+C.whatsapp+'?text='+encodeURIComponent('Olá! Preciso de ajuda com meu pedido.')}

/* ---------- cupom (o servidor confirma o código e o percentual) ---------- */
function cupomMsg(t,cls){const m=$('cupomMsg');m.textContent=t;m.className=cls||''}
async function applyCoupon(code,silent){
  code=String(code||'').trim().toUpperCase();
  if(!code){coupon='';couponPct=0;cupomMsg('');show();return}
  let j;
  try{j=await (await fetch('/api/checkout?coupon='+encodeURIComponent(code))).json()}
  catch(e){   // sem API (ex.: abrindo o arquivo direto): só exibição; o servidor confere de novo ao pagar
    j=code===C.cupom.codigo?{valid:true,percent:C.cupom.percentual}:{valid:false};
  }
  if(j.valid){coupon=code;couponPct=j.percent;$('cupomIn').value=code;cupomMsg('Cupom '+code+' aplicado: '+j.percent+'% de desconto.','good')}
  else{coupon='';couponPct=0;if(!silent)cupomMsg('Cupom inválido.','badc');else cupomMsg('')}
  show();
}
$('cupomBtn').onclick=()=>applyCoupon($('cupomIn').value);
$('cupomIn').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();applyCoupon($('cupomIn').value)}});
if(coupon){$('cupomIn').value=coupon;couponPct=0;applyCoupon(coupon,true)}

/* ---------- máscaras e validação ---------- */
const dg=s=>String(s||'').replace(/\D/g,'');
function cpfOk(s){s=dg(s);if(s.length!==11||/^(\d)\1+$/.test(s))return false;for(let t=9;t<11;t++){let d=0;for(let c=0;c<t;c++)d+=s[c]*(t+1-c);d=((10*d)%11)%10;if(+s[t]!==d)return false}return true}
const maskCpf=v=>{v=dg(v).slice(0,11);return v.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2')};
const maskTel=v=>{v=dg(v).slice(0,11);return v.length>10?v.replace(/(\d{2})(\d{5})(\d{0,4})/,'($1) $2-$3'):v.length>6?v.replace(/(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3'):v.length>2?v.replace(/(\d{2})(\d*)/,'($1) $2'):v};
$('cpf').addEventListener('input',e=>e.target.value=maskCpf(e.target.value));
$('tel').addEventListener('input',e=>e.target.value=maskTel(e.target.value));
$('uf').addEventListener('input',e=>e.target.value=e.target.value.replace(/[^a-zA-Z]/g,'').toUpperCase());

const RULES={
  nome:v=>v.trim().split(/\s+/).length>=2&&v.trim().length>=5,
  email:v=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
  tel:v=>[10,11].includes(dg(v).length),
  cpf:cpfOk,
  rua:v=>v.trim().length>=2,
  num:v=>v.trim().length>=1,
  bairro:v=>v.trim().length>=2,
  cidade:v=>v.trim().length>=2,
  uf:v=>/^[A-Za-z]{2}$/.test(v.trim())
};
function validate(showErr){
  let first=null;
  for(const id in RULES){const el=$(id),ok=RULES[id](el.value);if(showErr)el.classList.toggle('bad',!ok);if(!ok&&!first)first=el}
  if(showErr&&first)first.focus();
  return !first;
}
Object.keys(RULES).forEach(id=>$(id).addEventListener('input',()=>{$(id).classList.remove('bad');steps()}));
function steps(){$('s2').classList.toggle('on',cepOk);$('s3').classList.toggle('on',cepOk&&validate(false))}

/* ---------- CEP -> frete + preenche endereço ---------- */
$('cep').addEventListener('input',async e=>{
  const v=dg(e.target.value).slice(0,8);e.target.value=v.length>5?v.slice(0,5)+'-'+v.slice(5):v;
  const m=$('cepMsg');cepOk=false;$('opts').hidden=true;$('dados').hidden=true;$('pagto').hidden=true;$('fin').hidden=true;steps();
  if(v.length!==8){m.textContent='';return}
  m.textContent='Consultando...';
  try{
    const d=await (await fetch('https://viacep.com.br/ws/'+v+'/json/')).json();
    if(dg($('cep').value)!==v)return;
    if(d.erro){m.textContent='CEP não encontrado. Confira os números.';return}
    m.innerHTML='Entrega para <b>'+d.localidade+'/'+d.uf+'</b>. Escolha o frete:';
    if(d.logradouro&&!$('rua').value)$('rua').value=d.logradouro;
    if(d.bairro&&!$('bairro').value)$('bairro').value=d.bairro;
    $('cidade').value=d.localidade||'';$('uf').value=d.uf||'';
  }catch(err){m.textContent='Escolha o frete e preencha o endereço:'}
  cepOk=true;$('opts').hidden=false;$('dados').hidden=false;$('pagto').hidden=false;$('fin').hidden=false;$('erro').textContent='';steps();
});

/* ---------- configuração + campos do cartão ---------- */
const cfgReady=fetch('/api/checkout?config=1').then(r=>r.json()).then(j=>{cfg=j;fillParc()}).catch(()=>{cfg=null});
const maskCard=v=>dg(v).slice(0,19).replace(/(\d{4})(?=\d)/g,'$1 ');
const maskVal=v=>{v=dg(v).slice(0,4);return v.length>2?v.slice(0,2)+'/'+v.slice(2):v};
$('cnum').addEventListener('input',e=>{e.target.value=maskCard(e.target.value);$('cardErr').textContent=''});
$('cval').addEventListener('input',e=>{e.target.value=maskVal(e.target.value);$('cardErr').textContent=''});
$('ccvv').addEventListener('input',e=>{e.target.value=dg(e.target.value).slice(0,4);$('cardErr').textContent=''});
$('cnome').addEventListener('input',()=>{$('cardErr').textContent=''});

/* Liga o SDK da HyperCash (chave pública). Só roda uma vez. */
function ensureSdk(){
  if(sdkReady)return sdkReady;
  sdkReady=(async()=>{
    if(!cfg||!cfg.publicKey||!window.FastSoft)throw new Error('card_unavailable');
    await window.FastSoft.setPublicKey(cfg.publicKey);
  })().catch(e=>{sdkReady=null;throw e});
  return sdkReady;
}
document.querySelectorAll('input[name=metodo]').forEach(r=>r.onchange=async()=>{
  method=r.value;$('pnPix').hidden=method!=='pix';$('pnCard').hidden=method==='pix';$('erro').textContent='';btnTxt();
  if(method==='credit_card'){
    await cfgReady;fillParc();
    ensureSdk().catch(()=>{$('cardErr').textContent='Cartão indisponível no momento. Use o Pix.'});
  }
});

/* Lê e valida o que o cliente digitou no cartão */
function readCard(){
  const number=dg($('cnum').value),holderName=$('cnome').value.trim().toUpperCase().replace(/\s+/g,' ');
  const val=dg($('cval').value),expMonth=val.slice(0,2),expYear='20'+val.slice(2,4),cvv=dg($('ccvv').value);
  const now=new Date(),yy=now.getFullYear(),mm=now.getMonth()+1,m=+expMonth,y=+expYear;
  if(number.length<13||number.length>19){return{err:'Confira o número do cartão.',el:'cnum'}}
  if(holderName.split(' ').length<2){return{err:'Informe o nome como está impresso no cartão.',el:'cnome'}}
  if(val.length!==4||m<1||m>12||y<yy||(y===yy&&m<mm)){return{err:'Validade inválida ou cartão vencido.',el:'cval'}}
  if(cvv.length<3){return{err:'Confira o código de segurança (CVV).',el:'ccvv'}}
  return{card:{number,holderName,expMonth,expYear,cvv}};
}

/* ---------- chamadas ao servidor ---------- */
function payload(extra){
  return Object.assign({qty,ship,coupon,
    buyer:{name:$('nome').value,email:$('email').value,cpf:dg($('cpf').value),phone:dg($('tel').value)},
    address:{cep:dg($('cep').value),street:$('rua').value,number:$('num').value,complement:$('comp').value,neighborhood:$('bairro').value,city:$('cidade').value,state:$('uf').value}
  },extra);
}
async function post(extra){
  const r=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload(extra))});
  const j=await r.json().catch(()=>({}));
  if(!r.ok){const e=new Error(j.error||'erro');e.info=j;throw e}
  return j;
}
function friendly(e){
  const i=(e&&e.info)||{};
  if(i.error==='invalid_buyer'||i.error==='invalid_address'){const el=$(i.field);if(el){el.classList.add('bad');el.focus()}return 'Confira os dados destacados.'}
  if(i.error==='validation')return 'Alguns dados não foram aceitos'+(i.message?': '+i.message:'')+'. Confira e tente de novo.';
  if(i.error==='duplicate')return 'Tente novamente em instantes.';
  return 'Não foi possível processar o pagamento agora. Tente novamente em instantes.';
}
const getStatus=async id=>{const r=await fetch('/api/checkout?status='+encodeURIComponent(id));const j=await r.json().catch(()=>({}));return j.status||''};
const PAID=['paid'],DEAD=['expired','canceled','refused','chargedback','refunded'];

/* ---------- telas ---------- */
function setBusy(on,txt){busy=on;$('fin').disabled=on;if(on&&txt)$('finTxt').textContent=txt;else btnTxt()}
function done(title,msg,ref){
  stopPoll();
  $('flow').hidden=true;$('pixBox').hidden=true;$('done').hidden=false;
  $('doneT').textContent=title;$('doneP').textContent=msg;$('doneRef').textContent=ref?'Pedido '+ref:'';$('doneRef').hidden=!ref;
  try{localStorage.removeItem('auriva_pedido')}catch(e){}
  window.scrollTo({top:0,behavior:'smooth'});
}
function stopPoll(){if(pollTimer){clearInterval(pollTimer);pollTimer=null}}

/* ---------- Pix ---------- */
async function payPix(){
  const j=await post({method:'pix'});lastRef=j.ref;
  $('flow').hidden=true;$('pixBox').hidden=false;
  $('pixCode').textContent=j.qr_code;
  const q=$('qr');q.innerHTML='';
  try{const qr=window.qrcode(0,'M');qr.addData(j.qr_code);qr.make();q.innerHTML=qr.createSvgTag(5,0)}catch(e){q.hidden=true}
  $('pixExp').textContent=j.expiration_date?'Este código vale até '+new Date(j.expiration_date).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+'.':'';
  $('pixSt').textContent='Aguardando pagamento…';
  window.scrollTo({top:0,behavior:'smooth'});
  stopPoll();let tries=0;
  pollTimer=setInterval(async()=>{
    tries++;if(tries>450){stopPoll();return}   // ~30 min
    try{
      const s=await getStatus(j.id);
      if(PAID.includes(s))done('Pagamento confirmado!','Recebemos seu Pix. Seu pedido já está sendo preparado para envio.',j.ref);
      else if(DEAD.includes(s)){stopPoll();$('pixSt').textContent='Este Pix expirou. Volte e gere um novo.'}
    }catch(e){}
  },4000);
}
$('copiar').onclick=async()=>{
  const t=$('pixCode').textContent;
  try{await navigator.clipboard.writeText(t)}catch(e){const a=document.createElement('textarea');a.value=t;document.body.append(a);a.select();try{document.execCommand('copy')}catch(_){}a.remove()}
  $('copiar').textContent='Código copiado!';setTimeout(()=>$('copiar').textContent='Copiar código Pix',2500);
};
$('voltar').onclick=()=>{stopPoll();$('pixBox').hidden=true;$('flow').hidden=false;window.scrollTo({top:0,behavior:'smooth'})};

/* ---------- Cartão ---------- */
async function payCard(){
  await cfgReady;
  const rc=readCard();
  if(rc.err){$('cardErr').textContent=rc.err;$(rc.el).focus();throw new Error('card_invalid')}
  try{await ensureSdk()}catch(e){$('cardErr').textContent='Cartão indisponível no momento. Use o Pix.';throw new Error('card_unavailable')}
  const F=window.FastSoft,cd=rc.card,inst=Number($('parcSel').value||1);

  /* 3D Secure — só roda se estiver ativo na conta. Se der problema, segue sem ele e o gateway decide. */
  try{
    if(await F.isThreeDSEnabled()){
      await F.initializeThreeDS({amount:total(),currency:'BRL',installments:inst,
        card:{number:cd.number,holderName:cd.holderName,expMonth:cd.expMonth,expYear:cd.expYear}});
      await F.authenticateThreeDS({
        customer:{name:$('nome').value.trim(),email:$('email').value.trim(),phoneNumber:dg($('tel').value)},
        address:{street:$('rua').value.trim(),streetNumber:$('num').value.trim(),complement:$('comp').value.trim()||'-',
          zipCode:dg($('cep').value),neighborhood:$('bairro').value.trim(),city:$('cidade').value.trim(),
          state:$('uf').value.trim().toUpperCase(),country:'BR'}
      });
      await F.finalizeThreeDS();
    }
  }catch(e){console.warn('3ds_skipped',e&&e.message)}

  let token;
  try{token=await F.encrypt(cd)}
  catch(e){$('cardErr').textContent='Não foi possível validar o cartão. Confira os dados.';throw new Error('card_invalid')}

  const j=await post({method:'credit_card',token,installments:inst});lastRef=j.ref;
  let st=j.status;
  if(PAID.includes(st))return done('Pagamento aprovado!','Recebemos seu pagamento. Seu pedido já está sendo preparado para envio.',lastRef);
  if(DEAD.includes(st))throw new Error('refused');
  // processando / em análise: acompanha por até ~1 minuto
  for(let i=0;i<12;i++){
    await new Promise(r=>setTimeout(r,5000));
    st=await getStatus(j.id).catch(()=>'');
    if(PAID.includes(st))return done('Pagamento aprovado!','Recebemos seu pagamento. Seu pedido já está sendo preparado para envio.',lastRef);
    if(DEAD.includes(st))throw new Error('refused');
  }
  return done('Pagamento em análise','Estamos confirmando seu pagamento com o banco. Guarde o número do pedido e fale com a gente se precisar.',lastRef);
}

/* ---------- botão principal ---------- */
$('fin').onclick=async()=>{
  const er=$('erro');er.textContent='';
  if(busy)return;
  if(!cepOk){er.textContent='Informe seu CEP para ver as opções de frete.';$('cep').focus();return}
  if(!validate(true)){er.textContent='Preencha os campos destacados.';return}
  setBusy(true,method==='pix'?'Gerando Pix...':'Processando pagamento...');
  try{
    if(method==='pix')await payPix();else await payCard();
  }catch(e){
    const m=e&&e.message;
    if(m==='card_invalid'||m==='card_unavailable'){/* mensagem já exibida no campo do cartão */}
    else if(m==='refused'||m==='failed'||m==='canceled')er.textContent='Pagamento não aprovado. Confira os dados do cartão ou tente outro cartão / Pix.';
    else er.textContent=friendly(e);
  }finally{setBusy(false)}
};
})();
