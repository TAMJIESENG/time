// Stopwatch page logic
(function(){
  const $ = (id)=>document.getElementById(id);
  const timeEl = $('swTime');
  const startStopBtn = $('swStartStop');
  const lapBtn = $('swLap');
  const resetBtn = $('swReset');
  const lapsEl = $('swLaps');

  let running=false; let base=0; let startAt=0; let rafId=null; let lapIdx=1;
  function fmt(ms){ const h=Math.floor(ms/3600000); const m=Math.floor((ms%3600000)/60000); const s=Math.floor((ms%60000)/1000); const ms3=Math.floor(ms%1000); return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(ms3).padStart(3,'0')}`; }
  function tick(){ if(!running) return; const now=performance.now(); const el=base + (now-startAt); if(timeEl) timeEl.textContent=fmt(el); rafId=requestAnimationFrame(tick); }
  function start(){ if(running) return; running=true; startAt=performance.now(); rafId=requestAnimationFrame(tick); startStopBtn.textContent='暂停'; }
  function stop(){ if(!running) return; const now=performance.now(); base += (now-startAt); running=false; cancelAnimationFrame(rafId); startStopBtn.textContent='继续'; }
  function reset(){ running=false; base=0; startAt=0; if(timeEl) timeEl.textContent=fmt(0); startStopBtn.textContent='开始'; lapsEl.innerHTML=''; lapIdx=1; }
  function lap(){ const ms = running ? (base + (performance.now()-startAt)) : base; const item=document.createElement('div'); item.textContent = `#${lapIdx++}  ${fmt(ms)}`; lapsEl.appendChild(item); }

  startStopBtn?.addEventListener('click', ()=>{ const t=startStopBtn.textContent; if(t==='开始'||t==='继续') start(); else stop(); });
  resetBtn?.addEventListener('click', reset);
  lapBtn?.addEventListener('click', lap);
})();

