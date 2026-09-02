(function(){
  'use strict';
  const KEY='planb_analytics_consent_v1';
  const METRIKA_ID=110884885;
  const UMAMI_ID='a01eef21-a164-429b-8dc4-60d8e7e556f5';

  function readChoice(){
    try{return localStorage.getItem(KEY)||''}catch(_){return ''}
  }

  function saveChoice(value){
    try{localStorage.setItem(KEY,value)}catch(_){}
  }

  function addScript(src,attrs){
    if(document.querySelector('script[data-planb-analytics="'+src+'"]'))return;
    const script=document.createElement('script');
    script.src=src;
    script.async=true;
    script.dataset.planbAnalytics=src;
    Object.keys(attrs||{}).forEach(function(key){script.setAttribute(key,attrs[key])});
    document.head.appendChild(script);
  }

  function loadAnalytics(){
    if(window.__planbAnalyticsLoaded)return;
    window.__planbAnalyticsLoaded=true;
    (function(m,e,t,r,i,k,a){
      m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
      m[i].l=1*new Date();
      k=e.createElement(t);a=e.getElementsByTagName(t)[0];k.async=1;k.src=r;k.dataset.planbAnalytics=r;a.parentNode.insertBefore(k,a);
    })(window,document,'script','https://mc.yandex.ru/metrika/tag.js?id='+METRIKA_ID,'ym');
    window.ym(METRIKA_ID,'init',{ssr:true,webvisor:true,clickmap:true,accurateTrackBounce:true,trackLinks:true});
    addScript('https://158-160-63-165.sslip.io/script.js',{'defer':'','data-website-id':UMAMI_ID});
    addScript('https://158-160-63-165.sslip.io/recorder.js',{'defer':'','data-website-id':UMAMI_ID});
  }

  function closeBanner(){
    const banner=document.getElementById('planb-cookie');
    if(banner)banner.remove();
  }

  function setChoice(value){
    saveChoice(value);
    closeBanner();
    if(value==='granted')loadAnalytics();
    document.dispatchEvent(new Event('scroll'));
  }

  function mountBanner(){
    if(document.getElementById('planb-cookie'))return;
    const style=document.createElement('style');
    style.textContent='#planb-cookie{position:fixed;right:18px;bottom:18px;z-index:9999;max-width:470px;display:grid;grid-template-columns:1fr auto;gap:12px 16px;align-items:center;padding:15px 16px;border-radius:16px;background:rgba(18,18,20,.97);backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.14);font:12px/1.45 Inter,Arial,sans-serif;color:#d1d1ce;box-shadow:0 18px 54px rgba(0,0,0,.58)}#planb-cookie a{color:#f5c400;text-decoration:underline}#planb-cookie-actions{display:flex;gap:8px;align-items:center}#planb-cookie button{padding:9px 13px;border-radius:9px;border:1px solid rgba(255,255,255,.15);background:transparent;color:#eee;cursor:pointer;font:700 12px Inter,Arial,sans-serif}#planb-cookie .accept{border-color:#f5c400;background:#f5c400;color:#15140c}@media(max-width:720px){#planb-cookie{left:10px;right:10px;bottom:10px;max-width:none;grid-template-columns:1fr}#planb-cookie-actions{justify-content:flex-end}}';
    document.head.appendChild(style);
    const banner=document.createElement('aside');
    banner.id='planb-cookie';
    banner.setAttribute('role','dialog');
    banner.setAttribute('aria-label','Настройка аналитики');
    banner.innerHTML='<span>Разрешить Яндекс.Метрику и собственную аналитику Plan B? Они помогают оценивать рекламу и удобство сайта. <a href="/privacy.html">Подробнее</a>.</span><span id="planb-cookie-actions"><button type="button" data-choice="denied">Только необходимые</button><button type="button" class="accept" data-choice="granted">Разрешить</button></span>';
    banner.addEventListener('click',function(event){
      const button=event.target.closest('[data-choice]');
      if(button)setChoice(button.dataset.choice);
    });
    document.body.appendChild(banner);
  }

  function init(){
    const choice=readChoice();
    if(choice==='granted'){loadAnalytics();return}
    if(choice==='denied')return;
    mountBanner();
  }

  window.PlanBAnalyticsConsent={grant:function(){setChoice('granted')},deny:function(){setChoice('denied')},reset:function(){saveChoice('');location.reload()}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
