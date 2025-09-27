// Simple client-side auth (demo only). Do NOT use for production.
(function(){
  const $ = (id)=>document.getElementById(id);
  const USERS_KEY='auth_users_v1';
  const CUR_KEY='auth_current_v1';

  function loadUsers(){ try{ const j=JSON.parse(localStorage.getItem(USERS_KEY)||'[]'); return Array.isArray(j)?j:[]; }catch{ return []; } }
  function saveUsers(arr){ try{ localStorage.setItem(USERS_KEY, JSON.stringify(arr)); }catch{} }
  function getCurrent(){ try{ return JSON.parse(localStorage.getItem(CUR_KEY)||'null'); }catch{ return null; } }
  function setCurrent(u){ try{ localStorage.setItem(CUR_KEY, JSON.stringify(u)); }catch{} }
  function logout(){ localStorage.removeItem(CUR_KEY); updateNav(); }

  function bufToHex(buf){ return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join(''); }
  function strToUtf8(s){ return new TextEncoder().encode(s); }
  async function hashPw(pw, saltHex){ const data = new Uint8Array([...hexToBytes(saltHex), ...strToUtf8(pw)]); const h = await crypto.subtle.digest('SHA-256', data); return bufToHex(h); }
  function hexToBytes(hex){ const arr=[]; for(let i=0;i<hex.length;i+=2){ arr.push(parseInt(hex.slice(i,i+2),16)); } return new Uint8Array(arr); }
  function randomHex(n=16){ const a=new Uint8Array(n); crypto.getRandomValues(a); return bufToHex(a); }

  async function registerUser(username, email, password){
    username = username.trim(); email = email.trim();
    if(!username || !password) throw new Error('用户名和密码必填');
    const users=loadUsers(); if(users.find(u=>u.username.toLowerCase()===username.toLowerCase())) throw new Error('用户名已存在');
    const salt = randomHex(16); const hash=await hashPw(password, salt);
    const role = users.length===0 ? 'admin' : 'user';
    const user={ username, email, salt, hash, role, nickname:'', avatar:'', createdAt: Date.now() };
    users.push(user); saveUsers(users); setCurrent({ username, email }); return user;
  }
  async function loginUser(username, password){
    const users=loadUsers(); const u=users.find(x=>x.username.toLowerCase()===username.trim().toLowerCase()); if(!u) throw new Error('用户不存在');
    const hash=await hashPw(password, u.salt); if(hash!==u.hash) throw new Error('密码不正确');
    setCurrent({ username: u.username, email: u.email }); return u;
  }

  function updateNav(){
    const nav = document.querySelector('.nav-links'); if(!nav) return;
    // remove existing auth links
    nav.querySelectorAll('.auth-link,.user-badge,.profile-link,.admin-link').forEach(el=>el.remove());
    const cur = getCurrent(); const users=loadUsers(); const me = cur ? users.find(u=>u.username===cur.username) : null;
    if(cur){
      const prof=document.createElement('a'); prof.href='profile.html'; prof.className='profile-link'; prof.textContent='资料'; nav.appendChild(prof);
      if(me && me.role==='admin'){ const adm=document.createElement('a'); adm.href='admin.html'; adm.className='admin-link'; adm.textContent='后台'; nav.appendChild(adm); }
      const badge=document.createElement('span'); badge.className='user-badge'; badge.textContent=cur.username; nav.appendChild(badge);
      const out=document.createElement('a'); out.href='#'; out.className='auth-link'; out.textContent='退出'; out.onclick=(e)=>{ e.preventDefault(); logout(); location.href='login.html'; }; nav.appendChild(out);
    } else {
      const l=document.createElement('a'); l.href='login.html'; l.className='auth-link'; l.textContent='登录'; nav.appendChild(l);
      const r=document.createElement('a'); r.href='register.html'; r.className='auth-link'; r.textContent='注册'; nav.appendChild(r);
    }
  }

  // Page handlers
  async function onLoginPage(){
    const form = $('loginForm'); if(!form) return false;
    form.addEventListener('submit', async (e)=>{
      e.preventDefault(); const u=$('loginUser').value||''; const p=$('loginPass').value||''; const hint=$('loginHint');
      const uWrap=$('loginUser') && $('loginUser').closest('.input'); const pWrap=$('loginPass') && $('loginPass').closest('.input');
      if(uWrap) uWrap.classList.remove('error'); if(pWrap) pWrap.classList.remove('error'); hint.textContent=''; hint.classList.remove('warn');
      try{
        await loginUser(u,p);
        hint.textContent='登录成功';
        try{ if(typeof window.playLoginSuccess==='function'){ window.playLoginSuccess(); } }catch{}
        setTimeout(()=>{ location.href = (new URLSearchParams(location.search).get('next')||'index.html'); }, 900);
      }
      catch(err){ hint.textContent=err.message||'登录失败'; hint.classList.add('warn'); if(uWrap) uWrap.classList.add('error'); if(pWrap) pWrap.classList.add('error'); }
    });
    return true;
  }
  async function onRegisterPage(){
    const form = $('regForm'); if(!form) return false;
    form.addEventListener('submit', async (e)=>{
      e.preventDefault(); const u=$('regUser').value||''; const em=$('regEmail').value||''; const p=$('regPass').value||''; const c=$('regConfirm').value||''; const hint=$('regHint');
      if(p!==c){ hint.textContent='两次密码不一致'; hint.classList.add('warn'); return; }
      try{ await registerUser(u,em,p); hint.textContent='注册成功'; setTimeout(()=>{ location.href='index.html'; }, 400); }
      catch(err){ hint.textContent=err.message||'注册失败'; hint.classList.add('warn'); }
    });
    return true;
  }

  // Initialize
  // Harden core login: disabled check + stats update
  const __baseLoginUser = loginUser;
  loginUser = async function(username, password){
    const users = loadUsers();
    const u = users.find(x=>x.username.toLowerCase() === (username||'').trim().toLowerCase());
    if(!u) throw new Error('用户不存在');
    if(u.disabled) throw new Error('账户已被禁用');
    const res = await __baseLoginUser(username, password);
    try{ u.lastLogin = Date.now(); u.loginCount = (u.loginCount||0)+1; saveUsers(users); }catch{}
    return res;
  };

  updateNav();
  onLoginPage(); onRegisterPage();
  window.Auth = { getCurrent, logout };
})();
