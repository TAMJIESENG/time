// Settings page logic (persist to localStorage and apply to page)
(function(){
  const $ = (id)=>document.getElementById(id);
  const enableCal = $('enableCal');
  const clickSound = $('clickSound');
  const themeSel = $('themeSelect');
  const motionSel = $('motionSelect');
  const volRange = $('volumeRange');
  const volVal = $('volumeVal');
  const accent1 = $('accentColor');
  const accent2 = $('accent2Color');
  const fontInput = $('fontFamily');
  const exportBtn = $('exportCfg');
  const importInput = $('importCfg');

  const KEY='cst_settings_v1';
  function load(){ try{ const j=JSON.parse(localStorage.getItem(KEY)||'{}'); return j||{}; }catch{ return {}; } }
  function save(s){ try{ localStorage.setItem(KEY, JSON.stringify(s)); }catch{} }
  function apply(s){
    if(s.theme==='dark'||s.theme==='light') document.documentElement.dataset.theme=s.theme; else delete document.documentElement.dataset.theme;
    if(s.motion==='off'||s.motion==='low') document.documentElement.dataset.motion=s.motion; else delete document.documentElement.dataset.motion;
    if(s.accent) document.documentElement.style.setProperty('--accent', hexToHslStr(s.accent));
    if(s.accent2) document.documentElement.style.setProperty('--accent-2', hexToHslStr(s.accent2));
    if(s.font) document.body.style.fontFamily = `${s.font}, ` + getComputedStyle(document.body).getPropertyValue('font-family');
    if(typeof s.volume==='number'){ volRange && (volRange.value = String(Math.round(s.volume*100))); volVal && (volVal.textContent = String((s.volume).toFixed(2))); }
    if(enableCal) enableCal.checked = s.calibrationEnabled!==false;
    if(clickSound) clickSound.checked = s.click!==false;
    if(themeSel) themeSel.value = s.theme||'auto';
    if(motionSel) motionSel.value = s.motion||'auto';
    if(accent1) accent1.value = s.accent||'#0ea5e9';
    if(accent2) accent2.value = s.accent2||'#7c3aed';
    if(fontInput) fontInput.value = s.font||'';
  }
  function hexToHslStr(hex){ const m=hex.replace('#',''); const b=parseInt(m,16); const r=((b>>16)&255)/255,g=((b>>8)&255)/255,bl=(b&255)/255; const max=Math.max(r,g,bl),min=Math.min(r,g,bl); let h,s,l=(max+min)/2; if(max===min){h=s=0;} else { const d=max-min; s=l>0.5?d/(2-max-min):d/(max+min); switch(max){case r:h=(g-bl)/d+(g<bl?6:0);break;case g:h=(bl-r)/d+2;break;case bl:h=(r-g)/d+4;break;} h/=6; } return `${Math.round(h*360)} ${Math.round(s*100)}% ${Math.round(l*100)}%`; }

  let st = load();
  // defaults
  st = Object.assign({ calibrationEnabled:true, theme:'auto', motion:'auto', volume:0.4, accent:'#0ea5e9', accent2:'#7c3aed', font:'', click:true }, st);
  apply(st);

  enableCal?.addEventListener('change', ()=>{ st.calibrationEnabled = !!enableCal.checked; save(st); });
  clickSound?.addEventListener('change', ()=>{ st.click = !!clickSound.checked; save(st); });
  themeSel?.addEventListener('change', ()=>{ st.theme=themeSel.value; save(st); apply(st); });
  motionSel?.addEventListener('change', ()=>{ st.motion=motionSel.value; save(st); apply(st); });
  volRange?.addEventListener('input', ()=>{ const v = Math.max(0, Math.min(100, Number(volRange.value||0))); st.volume = v/100; volVal && (volVal.textContent = (st.volume).toFixed(2)); save(st); });
  accent1?.addEventListener('input', ()=>{ st.accent=accent1.value; save(st); apply(st); });
  accent2?.addEventListener('input', ()=>{ st.accent2=accent2.value; save(st); apply(st); });
  fontInput?.addEventListener('change', ()=>{ st.font=fontInput.value.trim(); save(st); apply(st); });

  exportBtn?.addEventListener('click', ()=>{
    const data = {
      settings: st,
      world: (()=>{ try{ return JSON.parse(localStorage.getItem('cst_world_v1')||'[]'); }catch{return [];} })(),
      alarms: (()=>{ try{ return JSON.parse(localStorage.getItem('cst_alarms_v1')||'[]'); }catch{return [];} })(),
    };
    const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`cst-config-${new Date().toISOString().slice(0,10)}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
  });
  importInput?.addEventListener('change', async ()=>{
    const f=importInput.files?.[0]; if(!f) return; try{ const t=await f.text(); const j=JSON.parse(t); if(j.settings){ st=Object.assign(st,j.settings); save(st); apply(st); } if(Array.isArray(j.world)) localStorage.setItem('cst_world_v1', JSON.stringify(j.world)); if(Array.isArray(j.alarms)) localStorage.setItem('cst_alarms_v1', JSON.stringify(j.alarms)); alert('已导入配置'); }catch{ alert('导入失败'); }
  });
})();

