(function(){
  'use strict';

  // Keep the existing site-wide choice and expiry when only the notice UI changes.
  const STORAGE_KEY='planb_analytics_consent_v3';
  const LEGACY_KEYS=['planb_analytics_consent_v2','planb_analytics_consent_v1'];
  const ATTRIBUTION_KEY='planb_session_attribution_v1';
  const ATTRIBUTION_KEYS=['utm_source','utm_medium','utm_campaign','utm_content','utm_term','yclid'];
  const CONSENT_VERSION='planb-analytics-2026-09-29-v3';
  const PRIVACY_VERSION='planb-privacy-2026-09-29-v4';
  const PRIVACY_SHA256='455d7155c3aa47424bb66daee7e8dd2492532a30c567e5f84e8634bbe853ee83';
  const NOTICE_SHA256='567a90210a2d829edccf7b977e7727a4c0fd4b2e2b294826f4ccd574f2916270';
  const TTL_MS=180*24*60*60*1000;
  const METRIKA_ID=110884885;
  const SCRIPT_MARKER='planb-metrika';
  const GOAL_DEDUPE_MS=1500;
  const GOALS={
    phone:'CONTACT_PHONE',
    telegram:'CONTACT_TELEGRAM',
    whatsapp:'CONTACT_WHATSAPP',
    content_cta_click:'CONTENT_CTA',
    video_play:'VIDEO_PLAY',
    lead_success:'LEAD_FORM'
  };
  const TRACKED_GOALS=new Set(Object.keys(GOALS).map(function(key){return GOALS[key]}));
  const recentGoals=new Map();
  let playedVideos=new WeakSet();
  let goalEventsBound=false;

  function readState(){
    try{
      const state=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      if(!state||state.schema!=='planb-analytics-choice-v3')return null;
      if(state.version!==CONSENT_VERSION||state.privacy_version!==PRIVACY_VERSION)return null;
      if(state.privacy_sha256!==PRIVACY_SHA256||state.notice_sha256!==NOTICE_SHA256)return null;
      if(state.choice!=='granted'&&state.choice!=='denied')return null;
      if(!Number.isFinite(state.expires_at)||state.expires_at<=Date.now())return null;
      return state;
    }catch(_){return null}
  }

  function saveState(choice,recording){
    const decidedAt=new Date();
    const state={
      schema:'planb-analytics-choice-v3',
      version:CONSENT_VERSION,
      privacy_version:PRIVACY_VERSION,
      privacy_sha256:PRIVACY_SHA256,
      notice_sha256:NOTICE_SHA256,
      choice:choice,
      session_recording:choice==='granted'&&recording===true,
      decided_at:decidedAt.toISOString(),
      expires_at:decidedAt.getTime()+TTL_MS
    };
    try{
      localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
      LEGACY_KEYS.forEach(function(key){localStorage.removeItem(key)});
      const persisted=readState();
      if(!persisted||persisted.choice!==state.choice||persisted.session_recording!==state.session_recording||persisted.decided_at!==state.decided_at||persisted.expires_at!==state.expires_at){
        try{localStorage.removeItem(STORAGE_KEY)}catch(_){}
        return null;
      }
      return persisted;
    }catch(_){
      try{localStorage.removeItem(STORAGE_KEY)}catch(_){}
      return null;
    }
  }

  function hasAnalyticsConsent(){
    const state=readState();
    return Boolean(state&&state.choice==='granted');
  }

  function hasRecordingConsent(){
    const state=readState();
    // A previous general analytics grant must never enable the new optional toggle.
    return Boolean(state&&state.choice==='granted'&&state.session_recording===true);
  }

  function attributionFromUrl(){
    const result={};
    let params;
    try{params=new URLSearchParams(location.search||'')}catch(_){params=null}
    ATTRIBUTION_KEYS.forEach(function(key){
      const value=params?String(params.get(key)||'').trim().slice(0,300):'';
      result[key]=value;
    });
    return result;
  }

  function hasAttribution(values){
    return ATTRIBUTION_KEYS.some(function(key){return Boolean(values&&values[key])});
  }

  function storedAttribution(){
    if(!hasAnalyticsConsent())return null;
    try{
      const stored=JSON.parse(sessionStorage.getItem(ATTRIBUTION_KEY)||'null');
      if(!stored||stored.schema!=='planb-session-attribution-v1')return null;
      const values={};
      ATTRIBUTION_KEYS.forEach(function(key){values[key]=String(stored[key]||'').trim().slice(0,300)});
      return hasAttribution(values)?values:null;
    }catch(_){return null}
  }

  function captureFirstTouchAttribution(){
    if(!hasAnalyticsConsent()||storedAttribution())return;
    const values=attributionFromUrl();
    if(!hasAttribution(values))return;
    try{sessionStorage.setItem(ATTRIBUTION_KEY,JSON.stringify(Object.assign({schema:'planb-session-attribution-v1'},values)))}catch(_){}
  }

  function formAttribution(){
    const current=attributionFromUrl();
    return storedAttribution()||current;
  }

  function routeValue(){
    let route='/';
    try{route=location.pathname||'/'}catch(_){}
    route=route.replace(/\/{2,}/g,'/');
    if(route.length>1&&route.endsWith('/'))route=route.slice(0,-1);
    return route.slice(0,180)||'/';
  }

  function safeToken(value,limit){
    return String(value||'')
      .trim()
      .toLowerCase()
      .replace(/\.html?$/,'')
      .replace(/[^a-z0-9_-]+/g,'_')
      .replace(/^_+|_+$/g,'')
      .slice(0,limit||80);
  }

  function safeHost(value){
    let host=String(value||'').trim().toLowerCase();
    if(!host)return '';
    try{
      if(host.includes('://'))host=new URL(host).hostname;
    }catch(_){return ''}
    host=host.replace(/^www\./,'').replace(/:\d+$/,'');
    return /^[a-z0-9.-]{1,120}$/.test(host)?host:'';
  }

  function contentIdFromPath(pathname){
    const match=String(pathname||'').match(/^\/(blog|kejsy|video|otzyvy)(?:\/([^/?#]+))?\/?$/i);
    if(!match)return '';
    return safeToken(match[1]+'_'+(match[2]||'index'),80);
  }

  function currentContentId(){
    const declared=document.body&&document.body.dataset?document.body.dataset.contentId:'';
    return safeToken(declared,80)||contentIdFromPath(routeValue());
  }

  function canonicalGoal(value){
    const raw=String(value||'').trim();
    if(TRACKED_GOALS.has(raw))return raw;
    const name=raw.toLowerCase();
    if(GOALS[name])return GOALS[name];
    if(name==='phone_click'||name==='contact_phone')return GOALS.phone;
    if(name==='telegram_click'||name==='contact_telegram')return GOALS.telegram;
    if(name==='whatsapp_click'||name==='contact_whatsapp')return GOALS.whatsapp;
    if(name==='content_cta')return GOALS.content_cta_click;
    if(name==='lead_form')return GOALS.lead_success;
    return '';
  }

  function safeGoalPayload(goal,detail){
    const source=detail&&typeof detail==='object'?detail:{};
    const payload={route:routeValue()};
    const contentId=safeToken(source.content_id,80)||currentContentId();
    if(contentId)payload.content_id=contentId;

    let targetType=safeToken(source.target_type,32);
    if(goal===GOALS.phone)targetType='phone';
    if(goal===GOALS.telegram)targetType='telegram';
    if(goal===GOALS.whatsapp)targetType='whatsapp';
    if(goal===GOALS.video_play)targetType='video';
    if(goal===GOALS.lead_success)targetType='form';
    if(targetType)payload.target_type=targetType;

    let targetHost=safeHost(source.target_host);
    if(!targetHost&&goal===GOALS.telegram)targetHost='t.me';
    if(!targetHost&&goal===GOALS.whatsapp)targetHost='wa.me';
    if(targetHost)payload.target_host=targetHost;
    return payload;
  }

  function isDuplicateGoal(goal,payload){
    const now=Date.now();
    recentGoals.forEach(function(timestamp,key){
      if(now-timestamp>GOAL_DEDUPE_MS)recentGoals.delete(key);
    });
    const fingerprint=goal+'|'+JSON.stringify(payload);
    const previous=recentGoals.get(fingerprint)||0;
    if(now-previous<=GOAL_DEDUPE_MS)return true;
    recentGoals.set(fingerprint,now);
    return false;
  }

  function trackEvent(name,detail){
    const goal=canonicalGoal(name);
    if(!goal||!hasAnalyticsConsent()||typeof window.ym!=='function')return false;
    const payload=safeGoalPayload(goal,detail);
    if(isDuplicateGoal(goal,payload))return false;
    try{
      window.ym(METRIKA_ID,'reachGoal',goal,payload);
      return true;
    }catch(_){return false}
  }

  function linkUrl(link){
    try{return new URL(link.getAttribute('href')||'',location.href)}catch(_){return null}
  }

  function contactTarget(link){
    const href=String(link.getAttribute('href')||'').trim();
    if(/^tel:/i.test(href))return {event:'phone',target_type:'phone'};
    if(/^whatsapp:/i.test(href))return {event:'whatsapp',target_type:'whatsapp',target_host:'whatsapp'};
    if(/^tg:/i.test(href))return {event:'telegram',target_type:'telegram',target_host:'telegram'};
    const url=linkUrl(link);
    if(!url)return null;
    const host=safeHost(url.hostname);
    if(host==='t.me'||host==='telegram.me'||host==='telegram.dog')return {event:'telegram',target_type:'telegram',target_host:host};
    if(host==='wa.me'||host==='api.whatsapp.com'||host==='web.whatsapp.com')return {event:'whatsapp',target_type:'whatsapp',target_host:host};
    return null;
  }

  function hasLegacyContactHandler(link){
    return link.matches('[data-contact],[data-channel],.contact-link.call,.contact-link.tg,.contact-link.wa');
  }

  function contentCtaTarget(link){
    const url=linkUrl(link);
    if(!url||!/^https?:$/.test(url.protocol))return null;
    const explicit=link.matches('[data-content-cta],[data-analytics-event="content_cta_click"],[data-analytics-goal="CONTENT_CTA"]');
    const sameOrigin=url.origin===location.origin;
    const sourceId=currentContentId();
    const styledCta=link.matches('.more-card,.blog-card,.post-card,.scenario-card,.case-feature-card,.video-links a,.social-card,.nav-cta,.btn');
    if(!explicit&&!styledCta)return null;

    let targetType='external';
    if(sameOrigin){
      if(/^#?(contact|audit)$/i.test(url.hash.replace(/^#/,'')))targetType='lead_form';
      else if(/^\/blog(?:\/|$)/.test(url.pathname))targetType='blog';
      else if(/^\/kejsy(?:\/|$)/.test(url.pathname))targetType='case';
      else if(/^\/video(?:\/|$)/.test(url.pathname))targetType='video';
      else if(/^\/otzyvy(?:\/|$)/.test(url.pathname))targetType='testimonial';
      else if(/^\/uslugi(?:\/|$)/.test(url.pathname))targetType='service';
      else targetType='internal';
    }
    return {
      content_id:sourceId,
      target_type:targetType,
      target_host:safeHost(url.hostname)
    };
  }

  function videoContentId(video){
    const declared=video.dataset?video.dataset.contentId:'';
    if(declared)return safeToken(declared,80);
    const source=video.currentSrc||((video.querySelector('source[src]')||{}).getAttribute&&video.querySelector('source[src]').getAttribute('src'))||'';
    if(source){
      try{
        const filename=new URL(source,location.href).pathname.split('/').pop()||'';
        const fromSource=safeToken(filename.replace(/\.[^.]+$/,''),80);
        if(fromSource)return fromSource;
      }catch(_){}
    }
    return safeToken(video.getAttribute('aria-labelledby')||video.id,80)||currentContentId();
  }

  function bindGoalEvents(){
    if(goalEventsBound)return;
    goalEventsBound=true;
    document.addEventListener('click',function(event){
      const target=event.target&&event.target.closest?event.target.closest('a[href]'):null;
      if(!target)return;
      const contact=contactTarget(target);
      if(contact){
        if(!hasLegacyContactHandler(target))trackEvent(contact.event,contact);
        return;
      }
      const contentTarget=contentCtaTarget(target);
      if(contentTarget)trackEvent('content_cta_click',contentTarget);
    });
    document.addEventListener('play',function(event){
      const video=event.target;
      if(!video||video.tagName!=='VIDEO'||playedVideos.has(video))return;
      if(trackEvent('video_play',{content_id:videoContentId(video),target_type:'video'}))playedVideos.add(video);
    },true);
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
      webvisor:hasRecordingConsent(),
      clickmap:hasRecordingConsent(),
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
    try{sessionStorage.removeItem(ATTRIBUTION_KEY)}catch(_){}
  }

  function disableAnalytics(){
    try{if(typeof window.ym==='function')window.ym(METRIKA_ID,'destruct')}catch(_){}
    document.querySelectorAll('script[data-planb-analytics]').forEach(function(script){script.remove()});
    clearFirstPartyAnalyticsData();
    recentGoals.clear();
    playedVideos=new WeakSet();
    window.__planbAnalyticsLoaded=false;
  }

  function ensureStyles(){
    if(document.getElementById('planb-consent-styles'))return;
    const style=document.createElement('style');
    style.id='planb-consent-styles';
    style.textContent=`
      #planb-cookie{position:fixed;right:18px;bottom:18px;z-index:10001;box-sizing:border-box;width:420px;max-width:calc(100vw - 36px);max-height:calc(100dvh - 36px);overflow-y:auto;padding:14px;border-radius:14px;background:rgba(18,18,20,.98);backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.18);font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:#e1e1de;box-shadow:0 18px 54px rgba(0,0,0,.58)}
      #planb-cookie p{margin:0 0 6px;font:inherit}
      #planb-cookie-title{padding-right:30px}
      #planb-cookie a{color:#f5c400;text-decoration:underline}
      #planb-cookie-status{color:#bdbdb8;font-size:12px}
      #planb-cookie-status:empty{display:none}
      #planb-cookie details{margin:0;padding:0;border:0;background:none;font:inherit}
      #planb-cookie summary{position:static;box-sizing:border-box;min-height:44px;padding:0;display:flex;align-items:center;gap:7px;cursor:pointer;color:#e1e1de;font:600 12px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;list-style:none}
      #planb-cookie summary::-webkit-details-marker{display:none}
      #planb-cookie summary::after{content:none;display:none}
      #planb-cookie summary::before{content:'+';font-size:18px;font-weight:400}
      #planb-cookie details[open] summary::before{content:'−'}
      #planb-cookie details[open] p{margin:0 0 10px}
      #planb-cookie .recording-choice{display:flex;align-items:flex-start;gap:9px;margin:4px 0 10px;cursor:pointer}
      #planb-cookie .recording-choice input{flex:none;width:18px;height:18px;margin:1px 0 0;accent-color:#f5c400}
      #planb-cookie-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px}
      #planb-cookie button,#planb-analytics-settings{box-sizing:border-box;min-height:44px;padding:10px 12px;border-radius:9px;border:1px solid rgba(255,255,255,.26);background:#242428;color:#fff;cursor:pointer;font:700 12px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}
      #planb-cookie button:focus-visible,#planb-cookie summary:focus-visible,#planb-analytics-settings:focus-visible{outline:3px solid #f5c400;outline-offset:2px}
      #planb-cookie .decision{width:100%}
      #planb-cookie .close{position:absolute;right:4px;top:3px;min-width:44px;min-height:44px;padding:5px 9px;background:transparent;border-color:transparent;font-size:18px}
      #planb-analytics-settings{position:fixed;left:12px;bottom:12px;z-index:9998;background:rgba(18,18,20,.92);color:#ddd;font-weight:600;border-color:rgba(255,255,255,.2)}
      @media(max-width:720px){#planb-cookie{left:10px;right:10px;bottom:12px;width:auto;max-width:none;max-height:calc(100dvh - 24px);padding:12px}#planb-analytics-settings{font-size:11px}}
    `;
    document.head.appendChild(style);
  }

  function closeDialog(){
    const banner=document.getElementById('planb-cookie');
    if(banner)banner.remove();
  }

  function updateSettingsLabel(){
    const control=document.getElementById('planb-analytics-settings');
    const state=readState();
    if(control){
      const label=state&&state.choice==='granted'?'Аналитика: разрешена':'Настройки аналитики';
      control.textContent=label;
      control.setAttribute('aria-label',label);
      control.title=label;
    }
  }

  function setChoice(choice,recording){
    const wasLoaded=Boolean(window.__planbAnalyticsLoaded);
    const previousRecording=hasRecordingConsent();
    const persisted=saveState(choice,recording);
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
    if(choice==='granted'){
      if(wasLoaded&&previousRecording!==hasRecordingConsent()){
        disableAnalytics();
        location.reload();
      }else{
        captureFirstTouchAttribution();
        loadAnalytics();
      }
    }
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
    banner.setAttribute('aria-describedby','planb-cookie-summary');
    const status=state?(state.choice==='granted'?'Сейчас аналитика разрешена.':'Сейчас аналитика отключена.'):'';
    banner.innerHTML=(settingsMode&&state?'<button type="button" class="close" aria-label="Закрыть настройки">×</button>':'')+
      '<p id="planb-cookie-title"><strong>Аналитика сайта</strong></p>'+
      '<p id="planb-cookie-summary">Помогает нам улучшать сайт. Ваш выбор действует на всех его страницах.</p>'+
      '<details'+(settingsMode?' open':'')+'><summary>Настройки</summary><p id="planb-cookie-copy">С вашего разрешения Яндекс.Метрика считает посещения, переходы и успешные отправки форм. До разрешения аналитика отключена.</p>'+
      '<label class="recording-choice"><input type="checkbox" id="planb-recording-consent"'+(state&&state.choice==='granted'&&state.session_recording===true?' checked':'')+'><span>Также разрешаю запись посещений для улучшения интерфейса</span></label>'+
      '<p>Эта настройка отдельно включает Вебвизор и карту кликов: навигацию, прокрутку и взаимодействие со страницей. Поля форм, нажатия клавиш и отправка формы исключены из записи. Настройки можно изменить в любой момент. <a href="/privacy.html">Политика обработки данных</a>.</p></details>'+
      '<p id="planb-cookie-status">'+status+'</p>'+
      '<div id="planb-cookie-actions"><button type="button" class="decision" data-choice="denied">Отклонить</button><button type="button" class="decision allow" data-choice="granted">Разрешить</button></div>';
    banner.addEventListener('click',function(event){
      const choiceButton=event.target.closest('[data-choice]');
      if(choiceButton)setChoice(choiceButton.dataset.choice,banner.querySelector('#planb-recording-consent').checked);
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
    try{LEGACY_KEYS.forEach(function(key){localStorage.removeItem(key)})}catch(_){}
    bindGoalEvents();
    mountSettingsControl();
    const state=readState();
    if(state&&state.choice==='granted'){
      captureFirstTouchAttribution();
      loadAnalytics();
    }
    else if(!state)mountDialog(false);
  }

  window.PlanBAnalyticsConsent={
    version:CONSENT_VERSION,
    state:readState,
    track:trackEvent,
    attribution:formAttribution,
    grant:function(){setChoice('granted')},
    deny:function(){setChoice('denied')},
    open:function(){mountDialog(true)},
    reset:function(){
      try{
        localStorage.removeItem(STORAGE_KEY);
        LEGACY_KEYS.forEach(function(key){localStorage.removeItem(key)});
        sessionStorage.removeItem(ATTRIBUTION_KEY);
      }catch(_){}
      disableAnalytics();
      location.reload();
    }
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
