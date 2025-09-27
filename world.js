// World Clock page logic: list management, live times, diff table
(function(){
  const $ = (id)=>document.getElementById(id);
  const inputEl = $('worldInput');
  const addBtn = $('worldAdd');
  const listEl = $('worldList');
  const sortEl = $('worldSort');
  const baseEl = $('worldBase');
  const diffEl = $('worldDiff');

  const KEY='cst_world_v1';
  function load(){ try{ const raw=localStorage.getItem(KEY); const j=JSON.parse(raw||'[]'); return Array.isArray(j)?j:[]; }catch{ return []; } }
  function save(arr){ try{ localStorage.setItem(KEY, JSON.stringify(arr)); }catch{} }

  function addZone(zone){ const arr=load(); if(!zone) return; if(!arr.includes(zone)){ arr.push(zone); save(arr); render(); renderDiff(); } }
  function delZone(zone){ const arr=load().filter(z=>z!==zone); save(arr); render(); renderDiff(); }

  function zoneTime(d, zone){ try{ return new Intl.DateTimeFormat('zh-CN',{timeZone:zone,hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(d); }catch{ return '--:--:--'; } }
  function zoneOffsetMinutes(zone){ try{ const d=new Date(); const p=new Intl.DateTimeFormat('en-US',{timeZone:zone,timeZoneName:'shortOffset'}).formatToParts(d).find(x=>x.type==='timeZoneName')?.value||''; const m=p.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/i); if(!m) return null; const sign=m[1]==='-'?-1:1; const hh=parseInt(m[2],10); const mm=m[3]?parseInt(m[3],10):0; return sign*(hh*60+mm); }catch{ return null; } }

  function render(){ if(!listEl) return; const arr=load(); listEl.innerHTML=''; arr.forEach(z=>{ const row=document.createElement('div'); row.className='world-item'; const left=document.createElement('div'); left.className='w-title'; left.textContent=z; const time=document.createElement('div'); time.className='w-time'; time.dataset.zone=z; time.textContent='--:--:--'; const btn=document.createElement('button'); btn.className='btn ghost'; btn.textContent='移除'; btn.onclick=()=>delZone(z); row.appendChild(left); row.appendChild(time); row.appendChild(btn); listEl.appendChild(row); }); updateTimes(); }

  function updateTimes(){ if(!listEl) return; const now=new Date(); listEl.querySelectorAll('.w-time').forEach(el=>{ const z=el.dataset.zone; el.textContent=zoneTime(now,z); }); }

  function renderDiff(){ if(!diffEl) return; const arr=load(); const base = baseEl?.value || 'Asia/Shanghai'; const now=new Date(); const baseOff=zoneOffsetMinutes(base)||480; const rows=arr.map(z=>{ const t=zoneTime(now,z); const off=zoneOffsetMinutes(z); const dm = off==null?null:(off-baseOff); const sign = dm==null?'':(dm>=0?'+':'-'); const ab = Math.abs(dm||0); const hh=String(Math.floor(ab/60)).padStart(2,'0'); const mm=String(ab%60).padStart(2,'0'); return { z, t, diff: dm==null?'N/A':`${sign}${hh}:${mm}` }; });
    const sorted = (sortEl?.value==='time') ? rows.sort((a,b)=>a.t.localeCompare(b.t)) : rows.sort((a,b)=>a.z.localeCompare(b.z));
    diffEl.innerHTML = `<div class="world-item" style="font-weight:700"><div>时区</div><div>当前时间</div><div>相对${base} 时差</div></div>` + sorted.map(r=>`<div class="world-item"><div>${r.z}</div><div>${r.t}</div><div>${r.diff}</div></div>`).join('');
  }

  addBtn?.addEventListener('click', ()=> addZone((inputEl?.value||'').trim()));
  inputEl?.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ addZone((inputEl?.value||'').trim()); } });
  sortEl?.addEventListener('change', renderDiff);
  baseEl?.addEventListener('change', renderDiff);
  setInterval(()=>{ updateTimes(); renderDiff(); }, 1000);

  render(); renderDiff();
})();

