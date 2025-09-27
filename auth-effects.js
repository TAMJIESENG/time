// Visual micro-interactions for auth pages: ripple, parallax, subtle tilt
(function(){
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motion = document.documentElement.dataset.motion;
  const allowMotion = !prefersReduced && motion !== 'off';
  const ruleText = '至少8位，包含大小写/数字/符号中3类';

  function meetsComplexity(pw){
    if(!pw || pw.length < 8) return false;
    let c=0; if(/[A-Z]/.test(pw)) c++; if(/[a-z]/.test(pw)) c++; if(/[0-9]/.test(pw)) c++; if(/[^A-Za-z0-9]/.test(pw)) c++;
    return c >= 3;
  }

  // Ripple for buttons
  function attachRipple(root=document){
    root.addEventListener('click', (e)=>{
      const t = e.target.closest('.btn'); if(!t) return;
      const r = document.createElement('span'); r.className='rpl';
      const rect = t.getBoundingClientRect();
      const x = e.clientX - rect.left; const y = e.clientY - rect.top;
      r.style.left = x + 'px'; r.style.top = y + 'px';
      t.appendChild(r); setTimeout(()=>r.remove(), 650);
    });
  }

  // Parallax tilt for auth-side illustration
  function attachParallax(){
    const side = document.querySelector('.auth-side'); if(!side) return;
    let rx=0, ry=0; let rafId=null;
    function onMove(e){ if(!allowMotion) return; const rect=side.getBoundingClientRect(); const cx=rect.left+rect.width/2; const cy=rect.top+rect.height/2; const dx=(e.clientX-cx)/rect.width; const dy=(e.clientY-cy)/rect.height; rx = (-dy*6); ry = (dx*8); schedule(); }
    function schedule(){ if(rafId) return; rafId = requestAnimationFrame(()=>{ side.style.setProperty('--rx', rx.toFixed(2)+'deg'); side.style.setProperty('--ry', ry.toFixed(2)+'deg'); rafId=null; }); }
    side.classList.add('parallax');
    window.addEventListener('mousemove', onMove);
  }

  attachRipple(); attachParallax();
  applyBrandBg();
  // Attach toggles and strength meters per page
  attachPwToggleTo('loginPass');
  attachPwToggleTo('regPass'); attachPwToggleTo('regConfirm');
  attachPwToggleTo('rsPass'); attachPwToggleTo('rsConfirm');
  attachStrengthMeterFor('loginPass','passStrength','loginHint');
  attachStrengthMeterFor('regPass','regStrength','regHint');
  attachStrengthMeterFor('rsPass','rsStrength','rsHint');
  enhanceRegisterForm();
  enhanceResetForm();
  // Caps Lock indicators
  ['loginPass','regPass','regConfirm','rsPass','rsConfirm'].forEach(id=>attachCapsIndicatorTo(id));

  // Show/hide password toggle
  function attachPwToggleTo(inputId){
    const pass = document.getElementById(inputId); if(!pass) return;
    const field = pass.closest('.input'); if(!field || field.querySelector('.pw-toggle')) return;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'pw-toggle'; btn.setAttribute('aria-label','显示密码'); btn.title = '显示密码';
    btn.innerHTML = `
      <svg class="eye-open" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/></svg>
      <svg class="eye-closed" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" stroke="currentColor" stroke-width="1.5"/><path d="M4 20 20 4" stroke="currentColor" stroke-width="1.5"/></svg>
    `;
    btn.addEventListener('click', (e)=>{
      e.preventDefault(); const show = pass.type === 'password'; pass.type = show ? 'text' : 'password';
      btn.classList.toggle('show', show);
      btn.setAttribute('aria-label', show ? '隐藏密码' : '显示密码'); btn.title = show ? '隐藏密码' : '显示密码';
    });
    field.appendChild(btn);
  }

  // Password strength meter (rough heuristic)
  function attachStrengthMeterFor(inputId, meterId, beforeHintId){
    const pass = document.getElementById(inputId); if(!pass) return;
    const form = pass.closest('form'); if(!form) return;
    let meter = document.getElementById(meterId||'');
    if(!meter){ meter = document.createElement('div'); if(meterId) meter.id=meterId; meter.className='pass-strength'; const before = (beforeHintId && document.getElementById(beforeHintId)) || null; form.insertBefore(meter, before); }
    meter.style.display = '';
    const bar = document.createElement('div'); bar.className='bar'; meter.appendChild(bar);
    const txt = document.createElement('div'); txt.className='txt'; meter.appendChild(txt);
    const rule = document.createElement('div'); rule.className='rule-hint'; rule.textContent = ruleText; meter.appendChild(rule);
    function score(pw){ let s=0; if(pw.length>=8) s++; if(/[A-Z]/.test(pw)) s++; if(/[a-z]/.test(pw)) s++; if(/[0-9]/.test(pw)) s++; if(/[^A-Za-z0-9]/.test(pw)) s++; return Math.min(s,4); }
    function update(){ const val=pass.value||''; const n=score(val); const w=[0,25,50,75,100][n]; bar.style.setProperty('--w', w+'%'); const labels=['弱','较弱','一般','较强','很强']; txt.textContent = val ? ('密码强度：' + labels[n]) : ''; const ok = meetsComplexity(val); rule.classList.toggle('bad', !!val && !ok); rule.textContent = ruleText + (ok || !val ? '' : '（未满足）'); }
    pass.addEventListener('input', update); update();
  }

  // Early validation for register page to add error states without touching core auth.js
  function enhanceRegisterForm(){
    const f = document.getElementById('regForm'); if(!f) return;
    f.addEventListener('submit', (e)=>{
      const p = document.getElementById('regPass');
      const c = document.getElementById('regConfirm');
      const hint = document.getElementById('regHint');
      const pW = p && p.closest('.input'); const cW = c && c.closest('.input');
      if(hint){ hint.textContent=''; hint.classList.remove('warn'); }
      if(pW) pW.classList.remove('error'); if(cW) cW.classList.remove('error');
      if(p && !meetsComplexity(p.value)){
        if(hint){ hint.textContent='密码过于简单：' + ruleText; hint.classList.add('warn'); }
        if(pW) pW.classList.add('error');
        e.preventDefault(); e.stopImmediatePropagation(); return false;
      }
      if(p && c && p.value !== c.value){
        if(hint){ hint.textContent='两次密码不一致'; hint.classList.add('warn'); }
        if(pW) pW.classList.add('error'); if(cW) cW.classList.add('error');
        e.preventDefault(); e.stopImmediatePropagation(); return false;
      }
      return true;
    }, true);
    attachMatchIndicator('regPass','regConfirm');
  }

  function enhanceResetForm(){
    const f = document.getElementById('rsForm'); if(!f) return;
    f.addEventListener('submit', (e)=>{
      const p = document.getElementById('rsPass');
      const c = document.getElementById('rsConfirm');
      const hint = document.getElementById('rsHint');
      const pW = p && p.closest('.input'); const cW = c && c.closest('.input');
      if(hint){ hint.textContent=''; hint.classList.remove('warn'); }
      if(pW) pW.classList.remove('error'); if(cW) cW.classList.remove('error');
      if(p && !meetsComplexity(p.value)){
        if(hint){ hint.textContent='密码过于简单：' + ruleText; hint.classList.add('warn'); }
        if(pW) pW.classList.add('error');
        e.preventDefault(); e.stopImmediatePropagation(); return false;
      }
      if(p && c && p.value !== c.value){
        if(hint){ hint.textContent='两次密码不一致'; hint.classList.add('warn'); }
        if(pW) pW.classList.add('error'); if(cW) cW.classList.add('error');
        e.preventDefault(); e.stopImmediatePropagation(); return false;
      }
      return true;
    }, true);
    attachMatchIndicator('rsPass','rsConfirm');
  }

  function attachCapsIndicatorTo(inputId){
    const el = document.getElementById(inputId); if(!el) return;
    const wrap = el.closest('.input'); if(!wrap) return;
    let cap = wrap.querySelector('.caps-hint'); if(!cap){ cap = document.createElement('div'); cap.className='caps-hint'; cap.textContent='Caps Lock 开启'; wrap.appendChild(cap); }
    function set(show){ cap.style.opacity = show? '1':'0'; cap.style.transform = show? 'translateY(0)': 'translateY(4px)'; }
    set(false);
    function onKey(e){ const s = e.getModifierState && e.getModifierState('CapsLock'); set(!!s); }
    el.addEventListener('keydown', onKey); el.addEventListener('keyup', onKey); el.addEventListener('blur', ()=>set(false));
  }

  function attachMatchIndicator(passId, confirmId){
    const p = document.getElementById(passId); const c = document.getElementById(confirmId); if(!p || !c) return;
    const wrap = c.closest('.input'); if(!wrap) return; if(wrap.querySelector('.ok-badge')) return;
    const badge = document.createElement('span'); badge.className='ok-badge';
    badge.innerHTML = '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M7.5 10.5l2 2 4-4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    wrap.appendChild(badge);
    function update(){ const v=c.value; if(!v){ badge.classList.remove('show','bad'); return; } if(p.value===v){ badge.classList.add('show'); badge.classList.remove('bad'); } else { badge.classList.add('show','bad'); } }
    p.addEventListener('input', update); c.addEventListener('input', update); update();
  }

  // Allow custom brand background via localStorage key 'auth_brand_bg'
  function applyBrandBg(){
    try{
      const url = localStorage.getItem('auth_brand_bg')||''; if(url){
        document.documentElement.style.setProperty('--brand-bg', `url("${url}")`);
        const side = document.querySelector('.auth-side'); if(side) side.classList.add('has-brand');
      }
      const illus = localStorage.getItem('auth_illus_bg')||''; if(illus){ document.documentElement.style.setProperty('--illus-bg', `url("${illus}")`); }
    }catch{}
  }

  // Login success micro-animation (check badge + confetti)
  window.playLoginSuccess = function(){
    try{
      const form = document.getElementById('loginForm'); if(!form) return;
      const badge = document.createElement('div');
      badge.className='success-badge';
      badge.innerHTML = `
        <svg width="56" height="56" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="okg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#0ea5e9"/>
              <stop offset="1" stop-color="#7c3aed"/>
            </linearGradient>
          </defs>
          <circle cx="28" cy="28" r="26" fill="url(#okg)" opacity=".85"/>
          <circle cx="28" cy="28" r="24" fill="rgba(255,255,255,.85)"/>
          <path d="M18 28l6 6 14-14" stroke="#16a34a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      form.appendChild(badge);
      requestAnimationFrame(()=>badge.classList.add('show'));
      // Confetti
      const c = document.createElement('div'); c.className='confetti';
      const N = allowMotion ? 22 : 10;
      for(let i=0;i<N;i++){
        const s=document.createElement('span'); s.className='c';
        s.style.setProperty('--x', ((Math.random()*140)-70).toFixed(1)+'px');
        s.style.setProperty('--r', (Math.random()*360).toFixed(0)+'deg');
        s.style.setProperty('--h', (Math.random()*360).toFixed(0));
        s.style.animationDelay = (Math.random()*0.25).toFixed(2)+'s';
        c.appendChild(s);
      }
      form.appendChild(c);
      setTimeout(()=>{ badge.remove(); c.remove(); }, 1200);
    }catch{}
  };
})();
