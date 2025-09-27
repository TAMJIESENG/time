// 北京时间展示逻辑（Asia/Shanghai），含：网络授时校准、毫秒级秒针、整点报时、农历/节气、闹钟与倒计时
(function () {
  const loader = document.getElementById('loader');
  const app = document.getElementById('app');
  const hourEl = document.getElementById('hour');
  const minuteEl = document.getElementById('minute');
  const secondEl = document.getElementById('second');
  const msEl = document.getElementById('ms');
  const dateTextEl = document.getElementById('dateText');
  const ticksEl = document.getElementById('ticks');
  const hourHand = document.getElementById('hourHand');
  const minuteHand = document.getElementById('minuteHand');
  const secondHand = document.getElementById('secondHand');
  const calStatusEl = document.getElementById('calStatus');
  const lunarTextEl = document.getElementById('lunarText');
  const termTextEl = document.getElementById('termText');
  const sunTextEl = document.getElementById('sunText');
  const btnToggleSound = document.getElementById('toggleSound');
  const btnCalNow = document.getElementById('calibrateNow');
  const alarmTimeEl = document.getElementById('alarmTime');
  const btnSetAlarm = document.getElementById('setAlarm');
  const btnClearAlarm = document.getElementById('clearAlarm');
  const alarmStatusEl = document.getElementById('alarmStatus');
  const cdMinEl = document.getElementById('cdMin');
  const cdSecEl = document.getElementById('cdSec');
  const btnCdStart = document.getElementById('startCountdown');
  const btnCdPause = document.getElementById('pauseCountdown');
  const btnCdReset = document.getElementById('resetCountdown');
  const cdStatusEl = document.getElementById('cdStatus');
  // Settings & extras
  const enableCalEl = document.getElementById('enableCal');
  const themeSelectEl = document.getElementById('themeSelect');
  const volumeRangeEl = document.getElementById('volumeRange');
  const volumeValEl = document.getElementById('volumeVal');
  const halfHourChimeEl = document.getElementById('halfHourChime');
  const worldInputEl = document.getElementById('worldInput');
  const worldAddBtn = document.getElementById('worldAdd');
  const worldListEl = document.getElementById('worldList');
  const swTimeEl = document.getElementById('swTime');
  const swStartStopBtn = document.getElementById('swStartStop');
  const swLapBtn = document.getElementById('swLap');
  const swResetBtn = document.getElementById('swReset');
  const swLapsEl = document.getElementById('swLaps');

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SUPPORTS_IANA = (() => {
    try { new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai' }).format(new Date()); return true; } catch { return false; }
  })();

  // —— 网络授时校准（NTP-like over HTTPS，带离线与退避） ——
  const calibrator = (() => {
    // 更贴近国内网络的优先顺序
    const custom = Array.isArray(window.CST_ENDPOINTS) ? window.CST_ENDPOINTS : null;
    const endpoints = custom ?? [
      { url: 'https://api.m.taobao.com/rest/api3.do?api=mtop.common.getTimestamp', pick: (j) => parseInt(j?.data?.t, 10) },
      { url: 'https://quan.suning.com/getSysTime.do', pick: (j) => Date.parse((j?.sysTime2 || j?.sysTime1 || '').replace(' ', 'T') + '+08:00') },
      { url: 'https://worldtimeapi.org/api/timezone/Asia/Shanghai', pick: (j) => j.unixtime * 1000 },
      { url: 'https://worldtimeapi.org/api/timezone/Etc/UTC', pick: (j) => j.unixtime * 1000 },
      { url: 'https://timeapi.io/api/Time/current/zone?timeZone=Etc/UTC', pick: (j) => Date.parse(j.dateTime) }
    ];

    // 单调时钟：规避系统时间跳变
    const mono = (() => { const s0 = Date.now(); const p0 = performance.now(); return { now: () => s0 + (performance.now() - p0) }; })();

    let offsetMs = 0; // serverNow - mono.now()
    let rttMs = null;
    let lastOkAt = 0;
    let failCount = 0;
    const samples = [];
    const maxSamples = 7;

    function median(arr) {
      if (!arr.length) return 0;
      const s = [...arr].sort((a,b)=>a-b);
      const m = Math.floor(s.length/2);
      return s.length % 2 ? s[m] : (s[m-1]+s[m])/2;
    }

    function shuffle(a){ const x=[...a]; for(let i=x.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [x[i],x[j]]=[x[j],x[i]]; } return x; }

    async function fetchWithTimeout(url, ms=3500) {
      const ctrl = new AbortController();
      const t = setTimeout(()=>ctrl.abort(), ms);
      try { return await fetch(url, { cache: 'no-store', signal: ctrl.signal }); }
      finally { clearTimeout(t); }
    }

    async function tryEndpoint(ep) {
      const t0 = mono.now();
      const res = await fetchWithTimeout(ep.url, 3500);
      const t1 = mono.now();
      if (!res.ok) throw new Error('bad status');
      const data = await res.json();
      const stamp = ep.pick(data);
      if (!Number.isFinite(stamp)) throw new Error('bad payload');
      const rtt = t1 - t0;
      const estNow = stamp + rtt / 2; // 对称延迟假设
      const off = estNow - mono.now();
      return { off, rtt };
    }

    async function calibrate() {
      if (!navigator.onLine) { updateStatus(false, '离线（使用本机时间）'); return { ok:false, offsetMs, rttMs }; }
      calStatusEl && (calStatusEl.textContent = '校准中…');
      const order = shuffle(endpoints);
      for (const ep of order) {
        try {
          const r = await tryEndpoint(ep);
          samples.push(r.off);
          if (samples.length > maxSamples) samples.shift();
          const m = median(samples);
          offsetMs = m;
          rttMs = r.rtt;
          lastOkAt = Date.now();
          failCount = 0;
          updateStatus(true);
          return { ok:true, offsetMs, rttMs };
        } catch (_) {
          // 下一条
        }
      }
      failCount++;
      updateStatus(false);
      return { ok:false, offsetMs, rttMs };
    }

    function nowMs() { return mono.now() + offsetMs; }
    function lastStatus() { return { offsetMs, rttMs, lastOkAt }; }

    function updateStatus(ok, msg) {
      if (!calStatusEl) return;
      if (!ok) {
        calStatusEl.textContent = msg || '校准不可用（使用本机时间）';
        return;
      }
      const sign = offsetMs >= 0 ? '+' : '-';
      const ms = Math.abs(Math.round(offsetMs));
      calStatusEl.textContent = `校准 ${sign}${ms} ms · RTT ${Math.round(rttMs ?? 0)} ms`;
    }

    async function autoLoop() {
      const base = 5 * 60 * 1000; // 5min 正常周期
      const backoff = Math.min(base, 2000 * Math.pow(2, Math.max(0, failCount-1))); // 2s,4s,8s..<=5min
      let ok=false;
      const disabled = (window.settings && window.settings.s && window.settings.s.calibrationEnabled === false) || (location.protocol === 'file:');
      if (disabled) {
        updateStatus(false, location.protocol === 'file:' ? '本地文件模式（关闭校准）' : '校准已关闭');
      } else {
        const r = await calibrate();
        ok = !!r.ok;
      }
      const delay = ok ? base : backoff;
      setTimeout(autoLoop, delay);
    }

    window.addEventListener('online', () => calibrate());
    window.addEventListener('offline', () => updateStatus(false, '离线（使用本机时间）'));

    return { calibrate, nowMs, lastStatus, autoLoop };
  })();

  // —— 表盘刻度 ——
  function buildTicks() {
    if (!ticksEl) return;
    ticksEl.innerHTML = '';
    const rect = ticksEl.getBoundingClientRect();
    const size = Math.min(rect.width || 300, rect.height || 300);
    const cx = size / 2;
    const cy = size / 2;
    for (let i = 0; i < 60; i++) {
      const major = i % 5 === 0;
      const len = major ? 16 : 10;
      const thick = major ? 3 : 2;
      const a = (i * Math.PI) / 30; // 6°
      const r = size / 2 - len - 10; // 内边距约 10px
      const x = cx + r * Math.sin(a) - thick / 2;
      const y = cy - r * Math.cos(a) - len / 2;
      const el = document.createElement('div');
      el.className = 'tick' + (major ? ' major' : '');
      el.style.width = `${thick}px`;
      el.style.height = `${len}px`;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.transform = `rotate(${i * 6}deg)`;
      ticksEl.appendChild(el);
    }
  }

  // —— 时间部件（北京时间） ——
  function getBeijingParts(now = new Date()) {
    if (SUPPORTS_IANA && typeof Intl !== 'undefined') {
      const fmt = new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        weekday: 'long',
      });
      const parts = fmt.formatToParts(now);
      const pick = (type) => parts.find(p => p.type === type)?.value ?? '';
      return {
        y: parseInt(pick('year'), 10),
        m: pick('month'),
        d: pick('day'),
        h: pick('hour'),
        i: pick('minute'),
        s: pick('second'),
        w: pick('weekday')
      };
    } else {
      // 回退：将本机时间换算到 UTC+8
      const localMin = -now.getTimezoneOffset(); // 本地相对 UTC（东区为正）
      const diffMin = (480 - localMin); // 目标(UTC+8) - 本地
      const bj = new Date(now.getTime() + diffMin * 60000);
      const y = bj.getFullYear();
      const mm = String(bj.getMonth() + 1).padStart(2, '0');
      const dd = String(bj.getDate()).padStart(2, '0');
      const hh = String(bj.getHours()).padStart(2, '0');
      const ii = String(bj.getMinutes()).padStart(2, '0');
      const ss = String(bj.getSeconds()).padStart(2, '0');
      const weekMap = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
      return { y, m: mm, d: dd, h: hh, i: ii, s: ss, w: weekMap[bj.getDay()] };
    }
  }

  const state = { h: 0, i: 0, s: 0, lastHourChimed: null, soundOn: false };
  const settings = (()=>{
    const KEY='cst_settings_v1';
    let s={ calibrationEnabled:true, theme:'auto', volume:0.4, halfHour:false };
    try { const raw=localStorage.getItem(KEY); if(raw){ const j=JSON.parse(raw); Object.assign(s,j); } }catch{}
    function save(){ try{ localStorage.setItem(KEY, JSON.stringify(s)); }catch{} }
    function apply(){
      // theme
      if (s.theme === 'auto') { delete document.documentElement.dataset.theme; }
      else { document.documentElement.dataset.theme = s.theme; }
      // ui
      if(enableCalEl) enableCalEl.checked = !!s.calibrationEnabled;
      if(themeSelectEl) themeSelectEl.value = s.theme;
      if(volumeRangeEl){ volumeRangeEl.value = Math.round(s.volume*100); if(volumeValEl) volumeValEl.textContent=`${Math.round(s.volume*100)}%`; }
      if(halfHourChimeEl) halfHourChimeEl.checked = !!s.halfHour;
    }
    return { s, save, apply };
  })();
  try { window.settings = settings; } catch {}

  // —— 简易音频合成器 ——
  const audio = (() => {
    let ctx = null;
    function ensure() { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); return ctx; }
    function tone(freq = 880, dur = 0.15, type = 'sine', gain = settings.s.volume ?? 0.08, when = 0) {
      const ac = ensure();
      const t0 = ac.currentTime + when;
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = type; osc.frequency.value = freq;
      g.gain.value = gain;
      osc.connect(g).connect(ac.destination);
      osc.start(t0);
      g.gain.setTargetAtTime(gain, t0, 0.005);
      g.gain.setTargetAtTime(0.0001, t0 + dur * 0.8, 0.03);
      osc.stop(t0 + dur + 0.08);
    }
    function chimeHour() {
      tone(660, 0.12, 'sine', 0.06, 0);
      tone(990, 0.12, 'sine', 0.06, 0.12);
    }
    function chimeHalf() {
      tone(880, 0.10, 'sine', 0.05, 0);
    }
    function chimeAlarm() {
      tone(880, 0.18, 'triangle', 0.09, 0);
      tone(660, 0.18, 'triangle', 0.09, 0.18);
      tone(1320, 0.22, 'sawtooth', 0.08, 0.36);
    }
    return { ensure, tone, chimeHour, chimeHalf, chimeAlarm };
  })();

  // —— 数字时间更新（与秒线对齐） ——
  function updateDigitalOnce() {
    const now = new Date(calibrator.nowMs());
    const p = getBeijingParts(now);
    hourEl.textContent = p.h;
    minuteEl.textContent = p.i;
    secondEl.textContent = p.s;
    if (msEl) msEl.textContent = String(now.getMilliseconds()).padStart(3,'0');
    dateTextEl.textContent = `${p.y}年${p.m}月${p.d}日 ${p.w}`;
    state.h = parseInt(p.h, 10);
    state.i = parseInt(p.i, 10);
    state.s = parseInt(p.s, 10);
    // 整点报时
    if (state.soundOn) {
      if (state.i === 0 && state.s === 0) {
        const nowHour = state.h;
        if (state.lastHourChimed !== nowHour) {
          audio.chimeHour();
          state.lastHourChimed = nowHour;
        }
      }
      if (settings.s.halfHour && state.i === 30 && state.s === 0) {
        audio.chimeHalf();
      }
    }
  }

  function scheduleSecondAlignedUpdates() {
    function loop() {
      updateDigitalOnce();
      const ms = 1000 - (calibrator.nowMs() % 1000) + 5; // +5ms 抗抖
      setTimeout(loop, ms);
    }
    updateDigitalOnce();
    const ms = 1000 - (calibrator.nowMs() % 1000) + 5;
    setTimeout(loop, ms);
  }

  // —— 模拟表连续秒针 ——
  function animateAnalog() {
    if (prefersReduced) return; // 遵守减少动画偏好
    function frame() {
      const now = new Date(calibrator.nowMs());
      const ms = now.getMilliseconds();
      let sFloat = state.s + ms / 1000;
      let iFloat = state.i + sFloat / 60;
      let hFloat = (state.h % 12) + iFloat / 60;
      const secDeg = sFloat * 6;          // 360/60
      const minDeg = iFloat * 6;          // 360/60
      const hourDeg = hFloat * 30;        // 360/12
      secondHand.style.transform = `translate(-50%, -100%) rotate(${secDeg}deg)`;
      minuteHand.style.transform = `translate(-50%, -100%) rotate(${minDeg}deg)`;
      hourHand.style.transform = `translate(-50%, -100%) rotate(${hourDeg}deg)`;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function hideLoaderAndReveal() {
    const started = performance.now();
    const minShow = 800;
    const reveal = () => {
      loader.classList.add('hide');
      setTimeout(() => app.classList.remove('hidden'), 60);
    };
    const elapsed = performance.now() - started;
    if (elapsed >= minShow) reveal(); else setTimeout(reveal, minShow - elapsed);
  }

  // —— 农历/节气 ——
  function lunarCalc(date){
    // 1900-2100 常用算法（简化版）
    const lunarInfo=[0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,0x06ca0,0x0b550,0x15355,0x04da0,0x0a5d0,0x14573,0x052d0,0x0a9a8,0x0e950,0x06aa0,0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b5a0,0x195a6,0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x05ac0,0x0ab60,0x096d5,0x092e0,0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,0x05aa0,0x076a3,0x096d0,0x04bd7,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,0x14b63];
    const Animals=['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
    const Gan=['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
    const Zhi=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
    function lYearDays(y){let sum=348;for(let i=0x8000;i>0x8;i>>=1)sum+=(lunarInfo[y-1900]&i)?1:0;return sum+leapDays(y);} 
    function leapMonth(y){return lunarInfo[y-1900]&0xf;} 
    function leapDays(y){if(leapMonth(y))return (lunarInfo[y-1900]&0x10000)?30:29;else return 0;} 
    function monthDays(y,m){return (lunarInfo[y-1900]&(0x10000>>m))?30:29;} 
    // 基准：1900-01-31 为农历1900正月初一
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

  function currentTerm(date){
    const termNames=['小寒','大寒','立春','雨水','惊蛰','春分','清明','谷雨','立夏','小满','芒种','夏至','小暑','大暑','立秋','处暑','白露','秋分','寒露','霜降','立冬','小雪','大雪','冬至'];
    const sTermInfo=[0,21208,42467,63836,85337,107014,128867,150921,173149,195551,218072,240693,263343,285989,308563,331033,353350,375494,397447,419210,440795,462224,483532,504758];
    const y=date.getFullYear();
    function termDate(n){
      const off=Date.UTC(1900,0,6,2,5) + 31556925974.7*(y-1900) + sTermInfo[n]*60000;
      return new Date(off);
    }
    const now=date.getTime();
    let next=null;
    for(let i=0;i<24;i++){
      const d=termDate(i);
      if(d.getTime()>now){ next={name:termNames[i],date:d}; break; }
    }
    if(!next) return null;
    const mm=String(next.date.getMonth()+1).padStart(2,'0');
    const dd=String(next.date.getDate()).padStart(2,'0');
    return { name: next.name, date: next.date, dateStr: `${mm}-${dd}` };
  }

  function updateLunarAndTerm() {
    const now = new Date(calibrator.nowMs());
    const lunar = lunarCalc(now);
    lunarTextEl.textContent = `农历 ${lunar.yGanZhi}${lunar.yearAnimal}年 ${lunar.monthName}${lunar.dayName}`;
    const term = currentTerm(now);
    termTextEl.textContent = term ? `节气 ${term.name}（${term.dateStr}）` : '当月无节气';
    updateSunTimes();
  }

  // —— 日出日落（默认北京，若授权则用本地） ——
  let geo = { ok:false, lat:39.9042, lon:116.4074, label:'北京' };
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      geo = { ok:true, lat: pos.coords.latitude, lon: pos.coords.longitude, label: '本地' };
      updateSunTimes();
    }, ()=>{}, { enableHighAccuracy:false, timeout:2000, maximumAge: 60_000 });
  }
  function updateSunTimes(){
    if (!sunTextEl) return;
    const t = sunTimes(new Date(calibrator.nowMs()), geo.lat, geo.lon);
    if (!t) { sunTextEl.textContent = '日出/日落 暂不可用'; return; }
    const fmt = (d) => new Intl.DateTimeFormat('zh-CN', { hour:'2-digit', minute:'2-digit' }).format(d);
    sunTextEl.textContent = `${geo.label} 日出 ${fmt(t.sunrise)} · 日落 ${fmt(t.sunset)}`;
  }
  function sunTimes(date, lat, lon){
    // 基于简化的 NOAA/SunCalc 算法
    const rad = Math.PI/180, deg = 180/Math.PI; const e = rad*23.4397; const J2000 = 2451545;
    function toJulian(d){ return d/86400000 - 0.5 + 2440587.5; }
    function fromJulian(j){ return new Date((j - 2440587.5 + 0.5)*86400000); }
    function solarMeanAnomaly(d){ return rad*(357.5291 + 0.98560028*d); }
    function eclipticLongitude(M){ const C = rad*(1.9148*Math.sin(M) + 0.02*Math.sin(2*M) + 0.0003*Math.sin(3*M)); return M + C + rad*102.9372 + Math.PI; }
    function declination(L){ return Math.asin(Math.sin(L)*Math.sin(e)); }
    function hourAngle(phi, dec, h0){ return Math.acos((Math.sin(h0)-Math.sin(phi)*Math.sin(dec)) / (Math.cos(phi)*Math.cos(dec))); }
    const lw = -lon*rad; const phi = lat*rad; const d = Math.round(toJulian(new Date(date.getFullYear(), date.getMonth(), date.getDate())) - J2000 - 0.0009 - lw/(2*Math.PI));
    const Jnoon = J2000 + d + 0.0009 + lw/(2*Math.PI); // 近似
    const M = solarMeanAnomaly(Jnoon - J2000); const L = eclipticLongitude(M); const dec = declination(L);
    const h0 = rad*(-0.83); // 日出/日落几何高度
    const H = hourAngle(phi, dec, h0);
    const Jrise = Jnoon - H/(2*Math.PI) + 0.0053*Math.sin(M) - 0.0069*Math.sin(2*L);
    const Jset  = Jnoon + H/(2*Math.PI) + 0.0053*Math.sin(M) - 0.0069*Math.sin(2*L);
    return { sunrise: fromJulian(Jrise), sunset: fromJulian(Jset) };
  }

  // —— 闹钟与倒计时 ——
  let alarmAtMs = null; // 绝对时间
  let cdTargetMs = null; // 绝对时间
  let cdPaused = false;
  function fmtHMS(ms) {
    if (ms < 0) ms = 0;
    const s = Math.floor(ms / 1000);
    const hh = String(Math.floor(s / 3600)).padStart(2,'0');
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2,'0');
    const ss = String(s % 60).padStart(2,'0');
    return `${hh}:${mm}:${ss}`;
  }
  function updateTimers() {
    const now = calibrator.nowMs();
    if (alarmAtMs) {
      const remain = alarmAtMs - now;
      if (remain <= 0) {
        alarmStatusEl.textContent = '响铃中';
        if (state.soundOn) audio.chimeAlarm();
        try { if (Notification && Notification.permission === 'granted') new Notification('闹钟到点'); } catch {}
        alarmAtMs = null;
      } else {
        alarmStatusEl.textContent = `距闹钟 ${fmtHMS(remain)}`;
      }
    }
    if (cdTargetMs && !cdPaused) {
      const remain = cdTargetMs - now;
      if (remain <= 0) {
        cdStatusEl.textContent = '倒计时结束';
        if (state.soundOn) audio.chimeAlarm();
        try { if (Notification && Notification.permission === 'granted') new Notification('倒计时结束'); } catch {}
        cdTargetMs = null;
      } else {
        cdStatusEl.textContent = `剩余 ${fmtHMS(remain)}`;
      }
    }
  }

  // —— 初始化 ——
  buildTicks();
  window.addEventListener('resize', buildTicks);
  scheduleSecondAlignedUpdates();
  animateAnalog();
  calibrator.autoLoop();
  btnCalNow?.addEventListener('click', () => calibrator.calibrate());
  btnToggleSound?.addEventListener('click', () => {
    state.soundOn = !state.soundOn;
    if (state.soundOn) audio.ensure();
    btnToggleSound.setAttribute('aria-pressed', String(state.soundOn));
    btnToggleSound.textContent = `报时音 ${state.soundOn ? '开' : '关'}`;
  });
  setInterval(() => { updateLunarAndTerm(); updateTimers(); }, 250);
  btnSetAlarm?.addEventListener('click', () => {
    const t = alarmTimeEl.value; // HH:MM
    if (!t) { alarmStatusEl.textContent = '请输入时间'; return; }
    try { if (Notification && Notification.permission === 'default') Notification.requestPermission(); } catch {}
    const [H,M] = t.split(':').map(Number);
    const now = new Date(calibrator.nowMs());
    const target = new Date(now);
    target.setHours(H, M, 0, 0);
    if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1); // 次日
    alarmAtMs = target.getTime();
    alarmStatusEl.textContent = `已设 ${t}`;
  });
  btnClearAlarm?.addEventListener('click', () => { alarmAtMs = null; alarmStatusEl.textContent = '未设置'; });
  btnCdStart?.addEventListener('click', () => {
    const min = Math.max(0, Number(cdMinEl.value || 0));
    const sec = Math.max(0, Math.min(59, Number(cdSecEl.value || 0)));
    const total = (min * 60 + sec) * 1000;
    try { if (Notification && Notification.permission === 'default') Notification.requestPermission(); } catch {}
    cdTargetMs = calibrator.nowMs() + total;
    cdPaused = false;
  });
  btnCdPause?.addEventListener('click', () => { cdPaused = !cdPaused; cdStatusEl.textContent = cdPaused ? '已暂停' : '继续中'; });
  btnCdReset?.addEventListener('click', () => { cdTargetMs = null; cdStatusEl.textContent = '未启动'; });
  window.addEventListener('load', hideLoaderAndReveal);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) updateDigitalOnce(); });
  // 设置初始化与事件
  settings.apply();
  enableCalEl?.addEventListener('change', (e)=>{ settings.s.calibrationEnabled = !!enableCalEl.checked; settings.save(); if (!settings.s.calibrationEnabled) { calStatusEl.textContent = '校准已关闭'; } else { calibrator.calibrate(); } });
  themeSelectEl?.addEventListener('change', ()=>{ settings.s.theme = themeSelectEl.value; settings.save(); settings.apply(); });
  volumeRangeEl?.addEventListener('input', ()=>{ const v = Math.max(0, Math.min(100, Number(volumeRangeEl.value||0))); settings.s.volume = v/100; settings.save(); if (volumeValEl) volumeValEl.textContent = `${v}%`; });
  halfHourChimeEl?.addEventListener('change', ()=>{ settings.s.halfHour = !!halfHourChimeEl.checked; settings.save(); });

  // —— 世界时钟 ——
  const world = (()=>{
    const KEY='cst_world_v1';
    let list=['UTC','Asia/Tokyo','Europe/London','America/New_York'];
    try{ const raw=localStorage.getItem(KEY); if(raw){ const j=JSON.parse(raw); if(Array.isArray(j)&&j.length) list=j; } }catch{}
    function save(){ try{ localStorage.setItem(KEY, JSON.stringify(list)); }catch{} }
    function add(zone){ if(!zone) return; if(!list.includes(zone)) { list.push(zone); save(); render(); } }
    function del(zone){ list=list.filter(z=>z!==zone); save(); render(); }
    function render(){ if(!worldListEl) return; worldListEl.innerHTML=''; list.forEach(z=>{
      const row=document.createElement('div'); row.className='world-item';
      const left=document.createElement('div'); left.className='w-title'; left.textContent=z;
      const right=document.createElement('div'); right.className='w-time'; right.dataset.zone=z; right.textContent='--:--:--';
      const btn=document.createElement('button'); btn.className='btn ghost'; btn.textContent='移除'; btn.onclick=()=>del(z);
      row.appendChild(left); row.appendChild(right); row.appendChild(btn); worldListEl.appendChild(row);
    }); updateTimes(); }
    function updateTimes(){ if(!worldListEl) return; const now = new Date(calibrator.nowMs()); worldListEl.querySelectorAll('.w-time').forEach(el=>{
      const z=el.dataset.zone; try{ const d=new Intl.DateTimeFormat('zh-CN',{timeZone:z,hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(now); el.textContent=d; }catch{ el.textContent='无效时区'; }
    }); }
    return { add, del, render, updateTimes };
  })();

  world.render();
  worldAddBtn?.addEventListener('click', ()=> world.add(worldInputEl.value.trim()));
  worldInputEl?.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ world.add(worldInputEl.value.trim()); } });
  setInterval(()=> world.updateTimes(), 1000);

  // —— 秒表 ——
  const stopwatch = (()=>{
    let running=false; let base=0; let startAt=0; let rafId=null; let lapIdx=1;
    function fmt(ms){ const h=Math.floor(ms/3600000); const m=Math.floor((ms%3600000)/60000); const s=Math.floor((ms%60000)/1000); const ms3=Math.floor(ms%1000); return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(ms3).padStart(3,'0')}`; }
    function tick(){ if(!running) return; const now=performance.now(); const el=base + (now-startAt); if(swTimeEl) swTimeEl.textContent=fmt(el); rafId=requestAnimationFrame(tick); }
    function start(){ if(running) return; running=true; startAt=performance.now(); rafId=requestAnimationFrame(tick); swStartStopBtn.textContent='暂停'; }
    function stop(){ if(!running) return; const now=performance.now(); base += (now-startAt); running=false; cancelAnimationFrame(rafId); swStartStopBtn.textContent='继续'; }
    function reset(){ running=false; base=0; startAt=0; if(swTimeEl) swTimeEl.textContent=fmt(0); swStartStopBtn.textContent='开始'; swLapsEl.innerHTML=''; lapIdx=1; }
    function lap(){ const ms = running ? (base + (performance.now()-startAt)) : base; const item=document.createElement('div'); item.textContent = `#${lapIdx++}  ${fmt(ms)}`; swLapsEl.appendChild(item); }
    return { start, stop, reset, lap };
  })();

  swStartStopBtn?.addEventListener('click', ()=>{ const t=swStartStopBtn.textContent; if(t==='开始'||t==='继续') stopwatch.start(); else stopwatch.stop(); });
  swResetBtn?.addEventListener('click', ()=> stopwatch.reset());
  swLapBtn?.addEventListener('click', ()=> stopwatch.lap());
})();
