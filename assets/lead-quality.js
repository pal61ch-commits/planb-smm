(function(){
  'use strict';

  const STORAGE_KEY='planb_lead_quality_v1';
  const RETRY_MS=15*60*1000;
  const RECEIPT_MS=180*24*60*60*1000;
  const SEMANTIC_FIELDS=['product','route','niche','scenario','message','service','budget','geo','call_time','company','email','contact_method','preferred_contact_time'];
  const memorySubmissions=new Map();
  let memoryState=null;

  function uuid(){
    if(window.crypto&&typeof window.crypto.randomUUID==='function')return window.crypto.randomUUID();
    const bytes=new Uint8Array(16);
    if(window.crypto&&typeof window.crypto.getRandomValues==='function')window.crypto.getRandomValues(bytes);
    else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);
    bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    const hex=Array.from(bytes,function(value){return value.toString(16).padStart(2,'0')}).join('');
    return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
  }

  function normalizePhone(value){
    let national=String(value||'').replace(/\D/g,'');
    if(national.length===11&&/^[78]/.test(national))national=national.slice(1);
    if(!/^[3489][0-9]{9}$/.test(national)||/^([0-9])\1{9}$/.test(national))return '';
    return '7'+national;
  }

  function text(value){return String(value||'').normalize('NFKC').trim().replace(/\s+/gu,' ').toLowerCase()}

  function readState(){
    let state=null;
    [function(){return window.localStorage},function(){return window.sessionStorage}].some(function(getStorage){
      try{
        const candidate=JSON.parse(getStorage().getItem(STORAGE_KEY)||'null');
        if(candidate&&candidate.schema===1&&typeof candidate.salt==='string'&&candidate.submissions&&candidate.counted){state=candidate;return true}
      }catch(_){}
      return false;
    });
    state=state||memoryState||{schema:1,salt:uuid(),submissions:{},counted:{}};
    const now=Date.now();
    Object.keys(state.submissions).forEach(function(key){if(!state.submissions[key]||state.submissions[key].expires_at<=now)delete state.submissions[key]});
    Object.keys(state.counted).forEach(function(key){if(!Number.isFinite(state.counted[key])||state.counted[key]<=now)delete state.counted[key]});
    return state;
  }

  function saveState(state){
    memoryState=state;
    const value=JSON.stringify(state);
    [function(){return window.localStorage},function(){return window.sessionStorage}].forEach(function(getStorage){
      try{getStorage().setItem(STORAGE_KEY,value)}catch(_){}
    });
  }

  function locked(task){
    // Web Locks serialize same-origin tabs. The server remains the authority when storage is unavailable.
    if(navigator.locks&&typeof navigator.locks.request==='function')return navigator.locks.request(STORAGE_KEY,task);
    return Promise.resolve().then(task);
  }

  async function fingerprint(payload,salt){
    const semantic=[normalizePhone(payload.phone)].concat(SEMANTIC_FIELDS.map(function(key){return text(payload[key])}));
    const value=JSON.stringify(semantic);
    if(!window.crypto||!window.crypto.subtle)return {memory:value};
    const digest=await window.crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+'|'+value));
    return {hash:Array.from(new Uint8Array(digest),function(byte){return byte.toString(16).padStart(2,'0')}).join('')};
  }

  function hasConsent(){return window.PlanBAnalyticsConsent?.state?.()?.choice==='granted'}

  function uint64(value){
    return typeof value==='string'&&/^[1-9][0-9]{0,19}$/.test(value)&&(value.length<20||value<='18446744073709551615')?value:'';
  }

  function withoutYclid(value){
    try{const url=new URL(value,location.href);url.searchParams.delete('yclid');return url.href}catch(_){return ''}
  }

  async function prepare(payload){
    const result=Object.assign({},payload);
    const record=await locked(async function(){
      const state=readState();
      const key=await fingerprint(result,state.salt);
      const records=key.hash?state.submissions:memorySubmissions;
      let previous=key.hash?records[key.hash]:records.get(key.memory);
      const now=Date.now();
      const valid=previous&&previous.expires_at>now&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(previous.id)&&Number.isFinite(Date.parse(previous.at))&&Date.parse(previous.at)<=now&&now-Date.parse(previous.at)<RETRY_MS&&previous.pd_version===result.pd_consent_version&&previous.privacy_version===result.privacy_version;
      if(!valid)previous={id:uuid(),at:new Date(now).toISOString(),expires_at:now+RETRY_MS,pd_version:result.pd_consent_version,privacy_version:result.privacy_version};
      if(key.hash)records[key.hash]=previous;else records.set(key.memory,previous);
      saveState(state);
      return previous;
    });
    result.submit_id=record.id;
    result.pd_consent_client_at=record.at;
    result.ts=record.at;
    const clientId=hasConsent()?await window.PlanBAnalyticsConsent?.getClientId?.():'';
    result.analytics_consent=hasConsent();
    delete result.metrica_client_id;
    if(result.analytics_consent&&uint64(clientId))result.metrica_client_id=clientId;
    result.yclid=result.analytics_consent?uint64(result.yclid):'';
    if(!result.analytics_consent){result.page=withoutYclid(result.page);result.ref=result.ref?withoutYclid(result.ref):''}
    return result;
  }

  async function accepted(result,payload){
    if(result?.ok!==true||result.stored!==true||result.replicated!==true||result.duplicate===true)return false;
    return locked(function(){
      const state=readState();
      const receipt=String(result.receipt_id||result.request_id||'');
      const keys=['submit:'+payload.submit_id];
      if(/^[a-zA-Z0-9_-]{1,128}$/.test(receipt))keys.push('receipt:'+receipt);
      if(keys.some(function(key){return state.counted[key]>Date.now()}))return false;
      if(!window.PlanBAnalyticsConsent?.track('lead_success',{target_type:'form'}))return false;
      keys.forEach(function(key){state.counted[key]=Date.now()+RECEIPT_MS});
      saveState(state);
      return true;
    }).catch(function(){return false});
  }

  window.PlanBLeadQuality={normalizePhone:normalizePhone,prepare:prepare,accepted:accepted};
})();
