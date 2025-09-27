// Advanced features layered on top of base clock
// Adds: lunar festivals + moon phase, multi-alarms with recurrence + import/export bridge,
// world clock diff table + sorting, calibration sparkline + threshold warning,
// screensaver + motion/font/accent customization, share/copy, PWA registration.
(function(){
  const $ = (id) => document.getElementById(id);
  const calStatusEl = $('calStatus');
  const lunarTextEl = $('lunarText');
  const termTextEl = $('termText');
  const moonTextEl = $('moonText');
  const festTextEl = $('festText');
  const sunTextEl = $('sunText');
  const offsetSvg = $('offsetSpark');
  const btnSaver = $('toggleSaver');
  const saverEl = $('saver');
  const saverTimeEl = $('saverTime');
  const saverDateEl = $('saverDate');
  const btnCopy = $('copyTime');
  const btnPoster = $('genPoster');
  const worldDiffEl = $('worldDiff');
  const worldSortEl = $('worldSort');
  const worldBaseEl = $('worldBase');
  const worldInputEl = $('worldInput');
  const worldAddBtn = $('worldAdd');
  const enableCalEl = $('enableCal');
  const motionSelectEl = $('motionSelect');
  const accentColorEl = $('accentColor');
  const accent2ColorEl = $('accent2Color');
  const fontFamilyEl = $('fontFamily');
  const exportCfgBtn = $('exportCfg');
  const importCfgInput = $('importCfg');
  const alarmLabelEl = $('alarmLabel');
  const alarmTime2El = $('alarmTime2');
  const repeatModeEl = $('repeatMode');
  const weekdayRowEl = $('weekdayRow');
  const ringSelectEl = $('ringSelect');
  const ringUrlEl = $('ringUrl');
  const testRingBtn = $('testRing');
  const addAlarmBtn = $('addAlarm');
  const alarmsListEl = $('alarmsList');

  // Helpers
  function nowMs(){ try{ if (window.CST?.now) return window.CST.now(); }catch{} return Date.now(); }
  function bjDate(ms = nowMs()){ const localMin = -(new Date(ms).getTimezoneOffset()); const diffMin = 480 - localMin; return new Date(ms + diffMin*60000); }
  function fmtParts(d, zone = 'Asia/Shanghai'){ try { return new Intl.DateTimeFormat('zh-CN',{timeZone:zone,hour12:false,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).formatToParts(d); } catch { return new Intl.DateTimeFormat('zh-CN',{hour12:false,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).formatToParts(d); } }
  function pick(parts, type){ return (parts.find(p=>p.type===type)?.value)||''; }
  function fmtHMSms(d){ const p=fmtParts(d); return `${pick(p,'hour')}:${pick(p,'minute')}:${pick(p,'second')}`; }

  // Sparkline of calibration offset (parse from text)
  const offsetBuf = [];
  const BUF_MAX = 120; // ~2 min at 1s sample if we sample each second
  const THRESH_MS = 150;
  function parseOffset(){
    if(!calStatusEl) return null;
    const m = calStatusEl.textContent.match(/([+-]?)(\d+)\s*ms/);
    if(!m) return null; const v = (m[1]==='-'?-1:1)*parseInt(m[2],10); return v;
  }
  function drawSpark(){
    if(!offsetSvg) return;
    const w = 200, h = 30; offsetSvg.setAttribute('viewBox',`0 0 ${w} ${h}`);
    if(offsetBuf.length<2){ offsetSvg.innerHTML=''; return; }
    const maxAbs = Math.max(THRESH_MS, ...offsetBuf.map(x=>Math.abs(x))); const mid=h/2;
    const pts = offsetBuf.map((v,i)=>{ const x = (i/(offsetBuf.length-1))*w; const y = mid - (v/maxAbs)*(h*0.45); return `${x.toFixed(1)},${y.toFixed(1)}`; }).join(' ');
    const path = `<polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1" />`;
    const midLine = `<line x1="0" y1="${mid}" x2="${w}" y2="${mid}" stroke="currentColor" stroke-opacity="0.2" stroke-width="1" />`;
    offsetSvg.innerHTML = midLine + path;
    const last = offsetBuf[offsetBuf.length-1];
    if (Math.abs(last) > THRESH_MS) calStatusEl.classList.add('warn'); else calStatusEl.classList.remove('warn');
  }

  setInterval(()=>{ const v = parseOffset(); if(v==null) return; offsetBuf.push(v); if(offsetBuf.length>BUF_MAX) offsetBuf.shift(); drawSpark(); }, 1000);

  // Screensaver
  btnSaver?.addEventListener('click', ()=> saverEl.classList.toggle('hidden'));
  saverEl?.addEventListener('click', ()=> saverEl.classList.add('hidden'));
  setInterval(()=>{ if(!saverEl || saverEl.classList.contains('hidden')) return; const d = bjDate(); saverTimeEl.textContent = fmtHMSms(d); const p=fmtParts(d); saverDateEl.textContent = `${pick(p,'year')}-${pick(p,'month')}-${pick(p,'day')}`; }, 250);

  // Share
  btnCopy?.addEventListener('click', async ()=>{
    const d = bjDate(); const p = fmtParts(d); const s = `${pick(p,'year')}-${pick(p,'month')}-${pick(p,'day')} ${fmtHMSms(d)} 北京时间`;
    try{ await navigator.clipboard.writeText(s); btnCopy.textContent='已复制'; setTimeout(()=>btnCopy.textContent='复制时间',1200);}catch{ alert('复制失败'); }
  });
  btnPoster?.addEventListener('click', ()=>{
    const canvas = document.createElement('canvas'); const W=1200,H=630; canvas.width=W; canvas.height=H; const ctx=canvas.getContext('2d');
    const grd = ctx.createLinearGradient(0,0,W,H); grd.addColorStop(0,getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()?`hsl(${getComputedStyle(document.documentElement).getPropertyValue('--accent')})`:'#0ea5e9'); grd.addColorStop(1,getComputedStyle(document.documentElement).getPropertyValue('--accent-2').trim()?`hsl(${getComputedStyle(document.documentElement).getPropertyValue('--accent-2')})`:'#7c3aed'); ctx.fillStyle=grd; ctx.fillRect(0,0,W,H);
    const d=bjDate(); const p=fmtParts(d); ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.textAlign='center'; ctx.font='900 140px system-ui, -apple-system, Segoe UI'; ctx.fillText(`${fmtHMSms(d)}`, W/2, H/2+40); ctx.font='500 36px system-ui, -apple-system, Segoe UI'; ctx.fillText(`${pick(p,'year')}-${pick(p,'month')}-${pick(p,'day')}`, W/2, H/2-80);
    const a=document.createElement('a'); a.download='beijing-time.png'; a.href=canvas.toDataURL('image/png'); a.click();
  });

  // World diff table
  function loadWorld(){ try{ return JSON.parse(localStorage.getItem('cst_world_v1')||'[]'); }catch{ return []; } }
  function zoneTime(d, zone){ try{ return new Intl.DateTimeFormat('zh-CN',{timeZone:zone,hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(d); }catch{ return '--:--:--'; } }
  function zoneOffsetMinutes(zone){ const d=new Date(); try{ const s=new Intl.DateTimeFormat('en-US',{timeZone:zone,timeZoneName:'shortOffset'}).formatToParts(d).find(p=>p.type==='timeZoneName')?.value||''; const m=s.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/i); if(!m) return null; const sign=m[1]==='-'?-1:1; const hh=parseInt(m[2],10); const mm=m[3]?parseInt(m[3],10):0; return sign*(hh*60+mm);}catch{return null;} }
  function renderWorldDiff(){ if(!worldDiffEl) return; const list = loadWorld(); const base = worldBaseEl?.value||'Asia/Shanghai'; const d=new Date(); const baseOff=zoneOffsetMinutes(base)||480; const rows=list.map(z=>{ const off=zoneOffsetMinutes(z); const diffMin = (off==null?null:(off-baseOff)); const sign = diffMin==null?'':(diffMin>=0?'+':'-'); const absMin = Math.abs(diffMin||0); const hh=String(Math.floor(absMin/60)).padStart(2,'0'); const mm=String(absMin%60).padStart(2,'0'); return { z, t: zoneTime(d,z), diff: (diffMin==null?'N/A':`${sign}${hh}:${mm}`)}; });
    const sorted = (worldSortEl?.value==='time') ? rows.sort((a,b)=>a.t.localeCompare(b.t)) : rows.sort((a,b)=>a.z.localeCompare(b.z));
    worldDiffEl.innerHTML = `<div class="world-item" style="font-weight:700"><div>时区</div><div>当前时间</div><div>相对${base} 时差</div></div>` +
      sorted.map(r=>`<div class="world-item"><div>${r.z}</div><div>${r.t}</div><div>${r.diff}</div></div>`).join('');
  }
  worldSortEl?.addEventListener('change', renderWorldDiff);
  worldBaseEl?.addEventListener('change', renderWorldDiff);
  worldAddBtn?.addEventListener('click', ()=> setTimeout(renderWorldDiff, 10));
  worldInputEl?.addEventListener('keydown', e=>{ if(e.key==='Enter') setTimeout(renderWorldDiff, 10); });
  setInterval(renderWorldDiff, 1000);

  // Lunar festivals + moon phase
  function lunarCalc(date){
    const lunarInfo=[0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,0x06ca0,0x0b550,0x15355,0x04da0,0x0a5d0,0x14573,0x052d0,0x0a9a8,0x0e950,0x06aa0,0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b5a0,0x195a6,0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x05ac0,0x0ab60,0x096d5,0x092e0,0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,0x05aa0,0x076a3,0x096d0,0x04bd7,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,0x14b63];
    const Animals=['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
    const Gan=['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
    const Zhi=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
    function lYearDays(y){let sum=348;for(let i=0x8000;i>0x8;i>>=1)sum+=(lunarInfo[y-1900]&i)?1:0;return sum+leapDays(y);} 
    function leapMonth(y){return lunarInfo[y-1900]&0xf;} 
    function leapDays(y){if(leapMonth(y))return (lunarInfo[y-1900]&0x10000)?30:29;else return 0;} 
    function monthDays(y,m){return (lunarInfo[y-1900]&(0x10000>>m))?30:29;} 
    const baseDate=new Date(1900,0,31);
    let offset=Math.floor((date - baseDate)/86400000);
    let y=1900; for(; y<2101 && offset>0; y++){ const days=lYearDays(y); if(offset<days)break; offset-=days; }
    if(offset<0){ y--; offset+=lYearDays(y); }
    let leap=leapMonth(y); let isLeap=false; let m; for(m=1; m<13 && offset>0; m++){ let md=monthDays(y,m); if(leap>0 && m==(leap+1) && !isLeap){ m--; md=leapDays(y); isLeap=true; } else if(isLeap && m==(leap+1)){ isLeap=false; } if(offset<md)break; offset-=md; }
    const d=offset+1; const yearAnimal=Animals[(y-4)%12];
    const gzYear=Gan[(y-4)%10]+Zhi[(y-4)%12];
    const nStr1=['','一','二','三','四','五','六','七','八','九','十'];
    const nStr2=['初','十','廿','卅'];
    function cDay(day){ if(day===10) return '初十'; if(day===20) return '二十'; if(day===30) return '三十'; return nStr2[Math.floor((day-1)/10)] + (day%10===0?'十':nStr1[day%10]); }
    function cMon(mm){ const mcn=['','正','二','三','四','五','六','七','八','九','十','冬','腊']; return (isLeap?'闰':'') + mcn[mm] + '月'; }
    return {year:y, month:m, day:d, isLeap, yearAnimal, yGanZhi:gzYear, monthName:cMon(m), dayName:cDay(d)};
  }
  function moonPhase(date){
    const syn=29.530588853; const ref=new Date(Date.UTC(2000,0,6,18,14));
    const days=(date-ref)/(86400000); let age=((days%syn)+syn)%syn; const illum=0.5*(1-Math.cos(2*Math.PI*age/syn));
    const names=['新月','娥眉月','上弦月','盈凸月','满月','亏凸月','下弦月','残月'];
    const idx = (age<1.84566)?0:(age<5.53699)?1:(age<9.22831)?2:(age<12.91963)?3:(age<16.61096)?4:(age<20.30228)?5:(age<23.99361)?6:7;
    return {age, illum, name:names[idx]};
  }
  function allTerms(year){
    const termNames=['小寒','大寒','立春','雨水','惊蛰','春分','清明','谷雨','立夏','小满','芒种','夏至','小暑','大暑','立秋','处暑','白露','秋分','寒露','霜降','立冬','小雪','大雪','冬至'];
    const sTermInfo=[0,21208,42467,63836,85337,107014,128867,150921,173149,195551,218072,240693,263343,285989,308563,331033,353350,375494,397447,419210,440795,462224,483532,504758];
    function termDate(n){ const off=Date.UTC(1900,0,6,2,5) + 31556925974.7*(year-1900) + sTermInfo[n]*60000; return new Date(off); }
    return termNames.map((name,i)=>({name,date:termDate(i)}));
  }
  function nextNewAndFull(date){ const syn=29.530588853; const ref=new Date(Date.UTC(2000,0,6,18,14)); const days=(date-ref)/86400000; let k=Math.floor(days/syn); const nm=new Date(ref.getTime()+ (k+1)*syn*86400000); const fm=new Date(ref.getTime()+ (k+1+0.5)*syn*86400000); const f=(d)=>`${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; return { new: nm, full: fm, newStr:f(nm), fullStr:f(fm) } }
  function festivalForDate(date, lunarObj){
    const y=date.getFullYear(), m=date.getMonth()+1, d=date.getDate();
    const solarMap={ '01-01':'元旦', '05-01':'劳动节', '10-01':'国庆节', '02-14':'情人节', '03-08':'妇女节', '06-01':'儿童节' };
    const key=`${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; let arr=[]; if(solarMap[key]) arr.push(solarMap[key]);
    const lMap={ '1-1':'春节','1-15':'元宵节','5-5':'端午节','7-7':'七夕','8-15':'中秋节','9-9':'重阳节','12-8':'腊八节' };
    const lk=`${lunarObj.month}-${lunarObj.day}`; if(lMap[lk]) arr.push(lMap[lk]);
    // 清明（按节气）
    const terms = allTerms(y); const qingming = terms.find(t=>t.name==='清明')?.date; if(qingming){ const qmKey=`${String(qingming.getMonth()+1).padStart(2,'0')}-${String(qingming.getDate()).padStart(2,'0')}`; if(qmKey===key) arr.push('清明节'); }
    // 除夕：农历腊月最后一天（简化：当日为腊月且下一天为正月初一）
    const tomorrow=new Date(date.getTime()+86400000); const lTomorrow = lunarCalc(tomorrow); if(lunarObj.monthName.startsWith('腊') && lTomorrow.monthName.startsWith('正') && lTomorrow.day===1) arr.push('除夕');
    return arr.join('、');
  }

  function hexToHslStr(hex){ // returns "H S% L%"
    const m = hex.replace('#',''); const bigint=parseInt(m,16); const r=((bigint>>16)&255)/255, g=((bigint>>8)&255)/255, b=(bigint&255)/255;
    const max=Math.max(r,g,b), min=Math.min(r,g,b); let h,s,l=(max+min)/2; if(max===min){h=s=0;} else { const d=max-min; s=l>0.5?d/(2-max-min):d/(max+min); switch(max){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;case b:h=(r-g)/d+4;break;} h/=6; } return `${Math.round(h*360)} ${Math.round(s*100)}% ${Math.round(l*100)}%`; }

  // Update sunrise/moon/fest every 2s
  setInterval(()=>{
    const d = bjDate(); const lunar = lunarCalc(d); const mp = moonPhase(d); if(moonTextEl) moonTextEl.textContent = `月相 ${mp.name} · ${Math.round(mp.illum*100)}%`;
    if (festTextEl) festTextEl.textContent = festivalForDate(d,lunar) || '今日无主要节日';
  },2000);

  // Multi-alarms with recurrence (localStorage)
  const AL_KEY='cst_alarms_v1';
  function loadAlarms(){ try{ const j=JSON.parse(localStorage.getItem(AL_KEY)||'[]'); return Array.isArray(j)?j:[]; }catch{return [];} }
  function saveAlarms(list){ try{ localStorage.setItem(AL_KEY, JSON.stringify(list)); }catch{} }
  function renderAlarms(){ if(!alarmsListEl) return; const list=loadAlarms(); alarmsListEl.innerHTML=''; list.forEach((a,idx)=>{
      const row=document.createElement('div'); row.className='world-item';
      const label=document.createElement('div'); label.textContent=(a.label||'(无)') + ` · 铃声:${a.ring||'soft'}`;
      const time=document.createElement('div'); time.textContent=a.time;
      const rec=document.createElement('div'); rec.textContent=recurrenceText(a);
      const test=document.createElement('button'); test.className='btn ghost'; test.textContent='测试'; test.onclick=()=>playAlarm(a);
      const btn=document.createElement('button'); btn.className='btn ghost'; btn.textContent='删除'; btn.onclick=()=>{ const l=loadAlarms(); l.splice(idx,1); saveAlarms(l); renderAlarms(); };
      row.appendChild(label); row.appendChild(time); row.appendChild(rec); row.appendChild(test); row.appendChild(btn); alarmsListEl.appendChild(row);
    }); }
  addAlarmBtn?.addEventListener('click', ()=>{
    const t=alarmTime2El?.value; if(!t) { alert('请填写时间'); return; }
    const mode = repeatModeEl?.value||'once';
    let days=[]; if (mode==='weekly' && weekdayRowEl){ weekdayRowEl.querySelectorAll('input[type="checkbox"]').forEach(c=>{ if(c.checked) days.push(Number(c.dataset.wd)); }); if(!days.length){ alert('请选择至少一个星期几'); return; } }
    const ring = ringSelectEl?.value||'soft';
    const url = (ring==='url' ? (ringUrlEl?.value||'') : '');
    const list=loadAlarms(); list.push({ label: alarmLabelEl?.value||'', time: t, mode, days, ring, url, enabled: true, lastFired:null }); saveAlarms(list); renderAlarms();
  });
  repeatModeEl?.addEventListener('change', ()=>{ weekdayRowEl && (weekdayRowEl.style.display = repeatModeEl.value==='weekly' ? '' : 'none'); });
  testRingBtn?.addEventListener('click', ()=>{ playAlarm({ ring: ringSelectEl?.value||'soft', url: ringUrlEl?.value||'' }); });
  renderAlarms();
  function shouldFireAlarm(a, d){
    const p = fmtParts(d); const hh=pick(p,'hour'); const mm=pick(p,'minute'); const ss=pick(p,'second'); if(ss!=='00') return false; const t=`${hh}:${mm}`; if(t!==a.time) return false;
    const wd = d.getDay();
    switch(a.mode){
      case 'daily': return true;
      case 'weekdays': return !(wd===0||wd===6);
      case 'weekly': return Array.isArray(a.days) && a.days.includes(wd);
      case 'once': default:
        const todayKey=`${pick(p,'year')}-${pick(p,'month')}-${pick(p,'day')}`;
        return a.lastFired!==todayKey;
    }
  }
  setInterval(()=>{
    const list=loadAlarms(); const d=bjDate(); let changed=false; list.forEach(a=>{
      if(!a.enabled) return; if(shouldFireAlarm(a,d)){
        try{ if (window.settings && window.settings.s && window.settings.s.soundOn){} }catch{}
        try{ if (Notification && Notification.permission==='default') Notification.requestPermission(); }catch{}
        try{ if (Notification && Notification.permission==='granted') new Notification(a.label?`闹钟: ${a.label}`:'闹钟到点'); }catch{}
        playAlarm(a);
        if (a.mode==='daily' || a.mode==='weekdays' || a.mode==='weekly') { a.lastFired = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; changed=true; }
        else { a.enabled=false; changed=true; }
      }
    }); if(changed) saveAlarms(list);
  }, 1000);

  function recurrenceText(a){
    switch(a.mode){
      case 'daily': return '每天';
      case 'weekdays': return '工作日';
      case 'weekly': return '周' + (a.days||[]).map(d=>['日','一','二','三','四','五','六'][d]).join('、');
      default: return '一次性';
    }
  }

  // 简易铃声发生器或播放 URL
  const ringAudio = (()=>{
    let ctx=null; function ac(){ return ctx||(ctx=new (window.AudioContext||window.webkitAudioContext)()); }
    function tone(freq,dur=0.2,type='sine',gain=0.08,when=0){ const c=ac(); const t0=c.currentTime+when; const o=c.createOscillator(); const g=c.createGain(); o.type=type; o.frequency.value=freq; g.gain.value=gain; o.connect(g).connect(c.destination); o.start(t0); g.gain.setTargetAtTime(gain,t0,0.005); g.gain.setTargetAtTime(0.0001, t0+dur*0.7, 0.03); o.stop(t0+dur+0.1); }
    function soft(){ tone(660,0.15,'sine',0.06,0); tone(880,0.15,'sine',0.06,0.15); }
    function bright(){ tone(880,0.12,'triangle',0.08,0); tone(1320,0.12,'triangle',0.08,0.12); tone(1760,0.12,'triangle',0.08,0.24); }
    function bell(){ tone(784,0.6,'sine',0.07,0); tone(1568,0.4,'sine',0.05,0); }
    return { soft, bright, bell };
  })();

  function playAlarm(a){
    const r = a.ring||'soft';
    if (r==='url' && a.url){ const audio=new Audio(a.url); audio.play().catch(()=>{}); return; }
    try{ ringAudio[r]?.(); }catch{}
  }

  // 高亮导航当前页面
  (function highlightNav(){
    const path = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a').forEach(a=>{ if((a.getAttribute('href')||'')===path){ a.classList.add('active'); } });
  })();

  // Apply customization controls (settings bridge) if base exposed
  function applyCustom(){
    const s = (window.settings?.s) || ( ()=>{ try{ return JSON.parse(localStorage.getItem('cst_settings_v1')||'{}'); }catch{return {}; } } )();
    if (s.motion) document.documentElement.dataset.motion = s.motion==='auto'?'':s.motion;
    if (s.accent) document.documentElement.style.setProperty('--accent', hexToHslStr(s.accent));
    if (s.accent2) document.documentElement.style.setProperty('--accent-2', hexToHslStr(s.accent2));
    if (s.font) document.body.style.fontFamily = `${s.font}, ` + getComputedStyle(document.body).getPropertyValue('font-family');
  }
  applyCustom();
  motionSelectEl?.addEventListener('change', ()=>{ const s=window.settings?.s; if(s){ s.motion=motionSelectEl.value; window.settings.save(); window.settings.apply(); } else { const o=JSON.parse(localStorage.getItem('cst_settings_v1')||'{}'); o.motion=motionSelectEl.value; localStorage.setItem('cst_settings_v1',JSON.stringify(o)); applyCustom(); } });
  accentColorEl?.addEventListener('input', ()=>{ const s=window.settings?.s; if(s){ s.accent=accentColorEl.value; window.settings.save(); window.settings.apply(); } else { const o=JSON.parse(localStorage.getItem('cst_settings_v1')||'{}'); o.accent=accentColorEl.value; localStorage.setItem('cst_settings_v1',JSON.stringify(o)); applyCustom(); } });
  accent2ColorEl?.addEventListener('input', ()=>{ const s=window.settings?.s; if(s){ s.accent2=accent2ColorEl.value; window.settings.save(); window.settings.apply(); } else { const o=JSON.parse(localStorage.getItem('cst_settings_v1')||'{}'); o.accent2=accent2ColorEl.value; localStorage.setItem('cst_settings_v1',JSON.stringify(o)); applyCustom(); } });
  fontFamilyEl?.addEventListener('change', ()=>{ const s=window.settings?.s; if(s){ s.font=fontFamilyEl.value.trim(); window.settings.save(); window.settings.apply(); } else { const o=JSON.parse(localStorage.getItem('cst_settings_v1')||'{}'); o.font=fontFamilyEl.value.trim(); localStorage.setItem('cst_settings_v1',JSON.stringify(o)); applyCustom(); } });
  exportCfgBtn?.addEventListener('click', ()=>{
    const data = {
      settings: (window.settings?.s) || ( ()=>{ try{ return JSON.parse(localStorage.getItem('cst_settings_v1')||'{}'); }catch{return {}; } } )(),
      world: loadWorld(),
      alarms: loadAlarms(),
    };
    const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`cst-config-${new Date().toISOString().slice(0,10)}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
  });
  importCfgInput?.addEventListener('change', async ()=>{
    const f=importCfgInput.files?.[0]; if(!f) return; try{ const t=await f.text(); const j=JSON.parse(t); if(j.settings) localStorage.setItem('cst_settings_v1', JSON.stringify(j.settings)); if(Array.isArray(j.world)) localStorage.setItem('cst_world_v1', JSON.stringify(j.world)); if(Array.isArray(j.alarms)) localStorage.setItem('cst_alarms_v1', JSON.stringify(j.alarms)); alert('已导入配置'); location.reload(); }catch{ alert('导入失败'); }
  });

  // 点击音效设置（设置页复选框）
  (function wireClickSetting(){
    const el = document.getElementById('clickSound'); if(!el) return;
    let obj={};
    try{ obj=JSON.parse(localStorage.getItem('cst_settings_v1')||'{}'); }catch{}
    if (typeof obj.click === 'undefined') obj.click = true;
    el.checked = !!obj.click;
    el.addEventListener('change', ()=>{ let o={}; try{ o=JSON.parse(localStorage.getItem('cst_settings_v1')||'{}'); }catch{} o.click=!!el.checked; localStorage.setItem('cst_settings_v1', JSON.stringify(o)); });
  })();

  // 全站点击音效（轻量合成）
  (function clickFX(){
    let ctx=null; function ac(){ return ctx||(ctx=new (window.AudioContext||window.webkitAudioContext)()); }
    function shouldPlay(){ try{ const o=JSON.parse(localStorage.getItem('cst_settings_v1')||'{}'); if(o && o.click===false) return false; return true; }catch{ return true; } }
    function volume(){ try{ const o=JSON.parse(localStorage.getItem('cst_settings_v1')||'{}'); const v=(o && typeof o.volume==='number')?o.volume:0.4; return Math.min(0.06, v*0.12); }catch{ return 0.04; } }
    function fx(){ if(!shouldPlay()) return; try{ const c=ac(); const t0=c.currentTime; const o=c.createOscillator(); const g=c.createGain(); o.type='triangle'; o.frequency.setValueAtTime(880,t0); o.frequency.exponentialRampToValueAtTime(1760, t0+0.03); g.gain.value=volume(); o.connect(g).connect(c.destination); o.start(t0); g.gain.setTargetAtTime(0.0001, t0+0.05, 0.02); o.stop(t0+0.08);}catch{} }
    document.addEventListener('click', (ev)=>{
      const t=ev.target; if(!(t instanceof Element)) return; const clickable = t.closest('button, a, input, select, textarea, label, summary, .world-item, .meta'); if(clickable){ fx(); }
    }, true);
  })();

  // PWA registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', ()=>{ navigator.serviceWorker.register('sw.js').catch(()=>{}); });
  }
})();
