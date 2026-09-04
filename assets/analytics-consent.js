(function(){
  'use strict';

  const STORAGE_KEY='planb_analytics_consent_v2';
  const LEGACY_KEY='planb_analytics_consent_v1';
  const CONSENT_VERSION='planb-analytics-2026-09-02-v2';
  const PRIVACY_VERSION='planb-privacy-2026-09-04-v3';
  const PRIVACY_SHA256='5cf6b80085eab30dc1d0a3f0c3dbafbf530ad271e5e1d33250c1a0e25b5508c8';
  const NOTICE_SHA256='c8445b179e648ea1867d3f1ac00aac22d8266c0f14839b620f6648b0ca25e275';
  const TTL_MS=180*24*60*60*1000;
  const METRIKA_ID=110884885;
  const SCRIPT_MARKER='planb-metrika';

  function readState(){
    try{
      const state=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      if(!state||state.schema!=='planb-analytics-choice-v2')return null;
      if(state.version!==CONSENT_VERSION||state.privacy_version!==PRIVACY_VERSION)return null;
      if(state.privacy_sha256!==PRIVACY_SHA256||state.notice_sha256!==NOTICE_SHA256)return null;
      if(state.choice!=='granted'&&state.choice!=='denied')return null;
      if(!Number.isFinite(state.expires_at)||state.expires_at<=Date.now())return null;
      return state;
    }catch(_){return null}
  }

  function saveState(choice){
    const decidedAt=new Date();
    const state={
      schema:'planb-analytics-choice-v2',
      version:CONSENT_VERSION,
      privacy_version:PRIVACY_VERSION,
      privacy_sha256:PRIVACY_SHA256,
      notice_sha256:NOTICE_SHA256,
      choice:choice,
      decided_at:decidedAt.toISOString(),
      expires_at:decidedAt.getTime()+TTL_MS
    };
    try{
      localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
      localStorage.removeItem(LEGACY_KEY);
      const persisted=readState();
      if(!persisted||persisted.choice!==state.choice||persisted.decided_at!==state.decided_at||persisted.expires_at!==state.expires_at){
        try{localStorage.removeItem(STORAGE_KEY)}catch(_){}
        return null;
      }
      return persisted;
    }catch(_){
      try{localStorage.removeItem(STORAGE_KEY)}catch(_){}
      return null;
    }
  }

  function loadAnalytics(){
    if(window.__planbAnalyticsLoaded)return;
    window.__planbAnalyticsLoaded=true;
    (function(m,e,t,r,i,k,a){
      m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
      m[i].l=1*new Date();
      k=e.createElement(t);a=e.getElementsByTagName(t)[0];k.async=1;k.src=r;
      k.dataset.planbAnalytics=SCRIPT_MARKER;a.parentNode.insertBefore(k,a);
    })(window,document,'script','https://mc.yandex.ru/metrika/tag.js?id='+METRIKA_ID,'ym');
    window.ym(METRIKA_ID,'init',{
      ssr:true,
      webvisor:false,
      clickmap:false,
      accurateTrackBounce:true,
      trackLinks:true
    });
  }

  function clearFirstPartyAnalyticsData(){
    try{
      document.cookie.split(';').forEach(function(part){
        const name=part.split('=')[0].trim();
        if(!/^(_ym|yabs|yandexuid|ymex|mdd$)/i.test(name))return;
        document.cookie=name+'=; Max-Age=0; path=/; SameSite=Lax';
        document.cookie=name+'=; Max-Age=0; path=/; domain=.'+location.hostname+'; SameSite=Lax';
      });
    }catch(_){}
    [window.localStorage,window.sessionStorage].forEach(function(storage){
      try{
        for(let i=storage.length-1;i>=0;i--){
          const key=storage.key(i)||'';
          if(/^(_ym|ym:|yandex)/i.test(key))storage.removeItem(key);
        }
      }catch(_){}
    });
  }

  function disableAnalytics(){
    try{if(typeof window.ym==='function')window.ym(METRIKA_ID,'destruct')}catch(_){}
    document.querySelectorAll('script[data-planb-analytics]').forEach(function(script){script.remove()});
    clearFirstPartyAnalyticsData();
    window.__planbAnalyticsLoaded=false;
  }

  function ensureStyles(){
    if(document.getElementById('planb-consent-styles'))return;
    const style=document.createElement('style');
    style.id='planb-consent-styles';
    style.textContent='#planb-cookie{position:fixed;right:18px;bottom:18px;z-index:10001;max-width:520px;padding:18px;border-radius:16px;background:rgba(18,18,20,.98);backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.18);font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:#e1e1de;box-shadow:0 18px 54px rgba(0,0,0,.58)}#planb-cookie p{margin:0 0 12px}#planb-cookie a{color:#f5c400;text-decoration:underline}#planb-cookie-status{color:#bdbdb8;font-size:12px}#planb-cookie-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:14px}#planb-cookie button,#planb-analytics-settings{min-height:42px;padding:10px 14px;border-radius:9px;border:1px solid rgba(255,255,255,.26);background:#242428;color:#fff;cursor:pointer;font:700 12px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}#planb-cookie button:focus-visible,#planb-analytics-settings:focus-visible{outline:3px solid #f5c400;outline-offset:2px}#planb-cookie .decision{flex:1 1 160px}#planb-cookie .allow{border-color:#f5c400}#planb-cookie .close{position:absolute;right:10px;top:8px;min-height:32px;padding:5px 9px;background:transparent;border-color:transparent;font-size:18px}#planb-analytics-settings{position:fixed;left:12px;bottom:12px;z-index:9998;min-height:36px;padding:8px 11px;background:rgba(18,18,20,.92);color:#ddd;font-weight:600;border-color:rgba(255,255,255,.2)}@media(max-width:720px){#planb-cookie{left:10px;right:10px;bottom:58px;max-width:none}#planb-cookie-actions{display:grid;grid-template-columns:1fr 1fr}#planb-cookie .decision{width:100%}#planb-analytics-settings{font-size:11px}}';
    document.head.appendChild(style);
  }

  function closeDialog(){
    const banner=document.getElementById('planb-cookie');
    if(banner)banner.remove();
  }

  function updateSettingsLabel(){
    const control=document.getElementById('planb-analytics-settings');
    const state=readState();
    if(control)control.textContent=state&&state.choice==='granted'?'Аналитика: разрешена':'Настройки аналитики';
  }

  function setChoice(choice){
    const wasLoaded=Boolean(window.__planbAnalyticsLoaded);
    const persisted=saveState(choice);
    if(!persisted){
      disableAnalytics();
      const status=document.getElementById('planb-cookie-status');
      if(status)status.textContent='Не удалось сохранить выбор. Аналитика остаётся отключена.';
      if(wasLoaded)location.reload();
      document.dispatchEvent(new CustomEvent('planb:analytics-consent',{detail:{choice:'storage_error',version:CONSENT_VERSION}}));
      return;
    }
    closeDialog();
    updateSettingsLabel();
    if(choice==='granted')loadAnalytics();
    else{
      disableAnalytics();
      if(wasLoaded)location.reload();
    }
    document.dispatchEvent(new CustomEvent('planb:analytics-consent',{detail:{choice:choice,version:CONSENT_VERSION}}));
  }

  function mountDialog(settingsMode){
    ensureStyles();
    closeDialog();
    const state=readState();
    const banner=document.createElement('aside');
    banner.id='planb-cookie';
    banner.setAttribute('role','dialog');
    banner.setAttribute('aria-labelledby','planb-cookie-title');
    banner.setAttribute('aria-describedby','planb-cookie-copy');
    const status=state?(state.choice==='granted'?'Сейчас аналитика разрешена.':'Сейчас аналитика отключена.'):'Выбор ещё не сделан.';
    banner.innerHTML=(settingsMode&&state?'<button type="button" class="close" aria-label="Закрыть настройки">×</button>':'')+
      '<p id="planb-cookie-title"><strong>Необязательная аналитика</strong></p>'+
      '<p id="planb-cookie-copy">Яндекс.Метрика помогает считать посещения и успешные отправки форм. Вебвизор, карта кликов и запись сессий отключены. До разрешения Метрика не загружается. <a href="/privacy.html">Подробнее</a>.</p>'+
      '<p id="planb-cookie-status">'+status+'</p>'+
      '<div id="planb-cookie-actions"><button type="button" class="decision" data-choice="denied">Отклонить</button><button type="button" class="decision allow" data-choice="granted">Разрешить Метрику</button></div>';
    banner.addEventListener('click',function(event){
      const choiceButton=event.target.closest('[data-choice]');
      if(choiceButton)setChoice(choiceButton.dataset.choice);
      if(event.target.closest('.close'))closeDialog();
    });
    banner.addEventListener('keydown',function(event){
      if(event.key==='Escape'&&settingsMode&&state)closeDialog();
    });
    document.body.appendChild(banner);
    const first=banner.querySelector('[data-choice="denied"]');
    if(first)first.focus({preventScroll:true});
  }

  function mountSettingsControl(){
    ensureStyles();
    if(document.getElementById('planb-analytics-settings'))return;
    const button=document.createElement('button');
    button.type='button';
    button.id='planb-analytics-settings';
    button.addEventListener('click',function(){mountDialog(true)});
    document.body.appendChild(button);
    updateSettingsLabel();
  }

  function init(){
    try{localStorage.removeItem(LEGACY_KEY)}catch(_){}
    mountSettingsControl();
    const state=readState();
    if(state&&state.choice==='granted')loadAnalytics();
    else if(!state)mountDialog(false);
  }

  window.PlanBAnalyticsConsent={
    version:CONSENT_VERSION,
    state:readState,
    grant:function(){setChoice('granted')},
    deny:function(){setChoice('denied')},
    open:function(){mountDialog(true)},
    reset:function(){
      try{localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(LEGACY_KEY)}catch(_){}
      disableAnalytics();
      location.reload();
    }
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
