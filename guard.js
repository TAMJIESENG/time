// Require login for application pages (demo guard). Excludes auth pages.
(function(){
  try{
    const path = location.pathname.split('/').pop().toLowerCase();
    const open = new Set(['login.html','register.html','forgot.html','reset.html','manifest.webmanifest','sw.js']);
    if (open.has(path) || path==='') return;
    const cur = JSON.parse(localStorage.getItem('auth_current_v1')||'null');
    if (!cur) {
      const next = encodeURIComponent(location.pathname + location.search + location.hash);
      location.replace('login.html?next=' + next);
    }
  }catch{}
})();

