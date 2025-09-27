// DeepSeek chat client with sessions, streaming, markdown, simple highlight, multiselect, import/export, and web search
(function(){
  const $ = (id)=>document.getElementById(id);
  // UI refs
  const msgsEl = $('chatMessages');
  const inputEl = $('chatInput');
  const sendBtn = $('chatSend');
  const stopBtn = $('chatStop');
  const retryBtn = $('chatRetry');
  const clearBtn = $('clearChat');
  const exportBtn = $('chatExport');
  const importInput = $('chatImport');
  const searchBtn = $('chatSearch');
  const modelEl = $('aiModel');
  const keyEl = $('aiKey');
  const saveKeyBtn = $('saveKey');
  const tempEl = $('aiTemp');
  const tempValEl = $('aiTempVal');
  const renderSel = $('aiRender');
  const sysEl = $('systemPrompt');
  const saveSysBtn = $('saveSys');
  const sessionSel = $('sessionSel');
  const sessionAddBtn = $('sessionAdd');
  const sessionRenBtn = $('sessionRename');
  const sessionDelBtn = $('sessionDel');
  const multiSelBtn = $('multiSelect');
  const multiCopyBtn = $('multiCopy');
  const multiDelBtn = $('multiDel');

  // Local storage keys
  const LS_KEY='deepseek_api_key';
  const SYS_KEY='deepseek_sys_prompt';
  const SESS_KEY='deepseek_sessions_v1';

  // Load persisted basics
  try{ const k=localStorage.getItem(LS_KEY); if(k) keyEl.value=k; }catch{}
  try{ const sp=localStorage.getItem(SYS_KEY); if(sp) sysEl.value=sp; }catch{}
  function getTemp(){ const v = Number(tempEl?.value||70)/100; return Math.max(0, Math.min(2, Number(v.toFixed(2)))); }
  function updateTempLabel(){ if(tempValEl) tempValEl.textContent = getTemp().toFixed(2); }
  updateTempLabel(); tempEl?.addEventListener('input', updateTempLabel);
  saveKeyBtn?.addEventListener('click', ()=>{ try{ localStorage.setItem(LS_KEY, keyEl.value.trim()); alert('已保存到本机'); }catch{ alert('保存失败'); } });
  saveSysBtn?.addEventListener('click', ()=>{ try{ localStorage.setItem(SYS_KEY, sysEl.value||''); sessions[currentId].system = sysEl.value||''; saveSessions(); alert('已保存系统提示'); }catch{} });

  // Sessions state
  let sessions = {}; let currentId = '';
  function loadSessions(){ try{ const raw=localStorage.getItem(SESS_KEY); if(raw){ const j=JSON.parse(raw); if(j && typeof j==='object') sessions=j; } }catch{} if(Object.keys(sessions).length===0){ const id='s'+Date.now(); sessions[id]={ name:'会话1', system: (sysEl?.value||''), messages:[] }; currentId=id; saveSessions(); } if(!currentId) currentId=Object.keys(sessions)[0]; }
  function saveSessions(){ try{ localStorage.setItem(SESS_KEY, JSON.stringify(sessions)); }catch{} }
  function messages(){ return sessions[currentId].messages; }
  function systemPrompt(){ return sessions[currentId].system || ''; }
  function renderSessionOptions(){ if(!sessionSel) return; sessionSel.innerHTML=''; for(const id of Object.keys(sessions)){ const opt=document.createElement('option'); opt.value=id; opt.textContent=sessions[id].name||id; if(id===currentId) opt.selected=true; sessionSel.appendChild(opt);} }
  function switchSession(id){ if(!sessions[id]) return; currentId=id; renderSessionOptions(); sysEl && (sysEl.value=sessions[id].system||''); renderAllMessages(); }
  loadSessions(); renderSessionOptions(); sysEl && (sysEl.value=sessions[currentId].system||sysEl.value||'');

  // Render all
  function renderAllMessages(){ msgsEl.innerHTML=''; for(const m of messages()){ addMsg(m.role, m.content); } msgsEl.scrollTop=msgsEl.scrollHeight; }

  // Selection mode
  const selection = new Set(); let selecting=false;
  function toggleSelecting(){ selecting=!selecting; multiSelBtn.textContent = selecting?'取消选择':'选择'; selection.clear(); renderAllMessages(); }

  // Chat state
  let lastUser=''; let currentAbort=null; let renderMode='md';
  renderSel?.addEventListener('change', ()=>{ renderMode = renderSel.value; renderAllMessages(); });

  // Helpers
  function escapeHtml(s){ return s.replace(/[&<>]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }
  function safeUrl(u){ try{ const url=new URL(u); if(url.protocol==='http:'||url.protocol==='https:'|| (url.protocol==='data:' && url.pathname.startsWith('image/'))) return url.toString(); }catch{} return ''; }
  function mdToHtml(md){
    // Extract triple backticks blocks
    const blocks=[]; let s=md;
    s=s.replace(/```([\w+-]*)\n([\s\S]*?)```/g,(m,lang,code)=>{ const i=blocks.push({lang,code})-1; return `[[[BLOCK_${i}]]]`; });
    // Tables (simple GFM)
    s=s.replace(/(^|\n)\|(.+?)\|\n\|\s*[-:|\s]+\|\n([\s\S]*?)(?=\n\n|$)/g,(m,prefix,header,body)=>{
      const heads=header.split('|').map(x=>x.trim());
      const rows=body.trim().split('\n').filter(Boolean).map(r=>r.replace(/^\|/,'').replace(/\|$/,'').split('|').map(c=>c.trim()));
      const thead = `<thead><tr>${heads.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${rows.map(cells=>`<tr>${cells.map(c=>`<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
      return `\n[[[TABLE_${(tableStore.push(thead+tbody))-1}]]]`;
    });
    // Images ![alt](url)
    const imgs=[]; s=s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,(m,alt,url)=>{ const u=safeUrl(url.trim()); if(!u) return alt; const i=imgs.push({alt,src:u})-1; return `[[[IMG_${i}]]]`; });
    // Escape others
    s=escapeHtml(s);
    // Inline code
    s=s.replace(/`([^`]+)`/g,'<code>$1</code>');
    // Bold/italic
    s=s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>');
    // Links
    s=s.replace(/(https?:\/\/[^\s)]+)(?![^<]*>)/g,(m,u)=>{ const su=safeUrl(u); return su?`<a href="${su}" target="_blank" rel="noopener noreferrer">${su}</a>`:m; });
    // Paragraphs
    let html=s.split(/\n{2,}/).map(p=>`<p>${p.replace(/\n/g,'<br/>')}</p>`).join('');
    // Restore images
    html=html.replace(/\[\[\[IMG_(\d+)\]\]\]/g,(_,i)=>{ const im=imgs[Number(i)]; return `<img src="${im.src}" alt="${escapeHtml(im.alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`; });
    // Restore tables
    html=html.replace(/\[\[\[TABLE_(\d+)\]\]\]/g,(_,i)=>`<table>${tableStore[Number(i)]}</table>`);
    // Restore code blocks
    html=html.replace(/\[\[\[BLOCK_(\d+)\]\]\]/g,(_,i)=>{ const b=blocks[Number(i)]; const lang=b.lang?` data-lang="${b.lang}"`:''; return `<pre><code${lang}>${escapeHtml(b.code)}</code></pre>`; });
    return html;
  }
  const tableStore=[];

  function addMsg(role, content){
    const div=document.createElement('div'); div.className='msg ' + (role==='user'?'user':'ai');
    const meta=document.createElement('div'); meta.className='meta'; meta.textContent= role==='user' ? '你' : (modelEl?.value||'AI');
    const body=document.createElement('div'); body.className='body'; body.innerHTML = renderMode==='raw' ? `<pre><code>${escapeHtml(content||'')}</code></pre>` : mdToHtml(content||'');
    const actions=document.createElement('div'); actions.className='actions';
    const copyBtn=document.createElement('button'); copyBtn.className='btn ghost'; copyBtn.textContent='复制'; copyBtn.onclick=async ()=>{ try{ await navigator.clipboard.writeText(content||''); copyBtn.textContent='已复制'; setTimeout(()=>copyBtn.textContent='复制',1200);}catch{} };
    actions.appendChild(copyBtn);
    // selection checkbox
    if(selecting){ const cb=document.createElement('input'); cb.type='checkbox'; cb.className='select-box'; cb.onchange=()=>{ if(cb.checked) selection.add(div); else selection.delete(div); }; meta.prepend(cb); div.classList.add('selecting'); }
    div.appendChild(meta); div.appendChild(body); if(role!=='user') div.appendChild(actions);
    msgsEl.appendChild(div); enhanceCodeBlocks(body); msgsEl.scrollTop=msgsEl.scrollHeight; return {div, body};
  }

  async function send(){
    const key = keyEl.value.trim(); if(!key){ alert('请先填写 API Key'); return; }
    const content = inputEl.value.trim(); if(!content){ return; }
    addMsg('user', content); inputEl.value=''; lastUser = content;
    // Build context
    const ctx=[]; const sys = (sysEl?.value||systemPrompt()||'').trim(); if(sys) ctx.push({ role:'system', content: sys });
    for(const m of messages()) ctx.push(m); ctx.push({ role:'user', content });
    sendBtn.disabled=true; sendBtn.textContent='发送中...'; stopBtn.disabled=false; retryBtn.disabled=true;
    let streamNode = addMsg('assistant', '');
    try{
      if (currentAbort) { try{ currentAbort.abort(); }catch{} }
      const ctrl = new AbortController(); currentAbort=ctrl;
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method:'POST', headers:{ 'Authorization':'Bearer '+key, 'Content-Type':'application/json' },
        body: JSON.stringify({ model: modelEl.value||'deepseek-chat', messages: ctx, stream:true, temperature:getTemp() }), signal: ctrl.signal
      });
      if(!res.ok){ const t=await res.text(); throw new Error(t||('HTTP '+res.status)); }
      if(!res.body || !('getReader' in res.body)){
        const j = await res.json(); const answer=j?.choices?.[0]?.message?.content || '(无内容)';
        streamNode.body.innerHTML = renderMode==='raw' ? `<pre><code>${escapeHtml(answer)}</code></pre>` : mdToHtml(answer);
        messages().push({ role:'assistant', content: answer }); saveSessions();
      }else{
        const reader=res.body.getReader(); const dec=new TextDecoder('utf-8'); let buf=''; let acc='';
        while(true){ const {value,done}=await reader.read(); if(done) break; buf += dec.decode(value,{stream:true});
          const parts=buf.split('\n\n'); buf=parts.pop();
          for(const p of parts){ const line=p.trim(); if(!line.startsWith('data:')) continue; const data=line.slice(5).trim(); if(data==='[DONE]') continue; try{ const j=JSON.parse(data); const delta=j?.choices?.[0]?.delta?.content||''; if(delta){ acc+=delta; streamNode.body.innerHTML=mdToHtml(acc); msgsEl.scrollTop=msgsEl.scrollHeight; } }catch{}
          }
        }
        if(acc){ messages().push({ role:'assistant', content: acc }); saveSessions(); }
      }
    }catch(e){ streamNode.body.innerHTML = mdToHtml((e.name==='AbortError') ? '(已停止)' : ('请求失败：'+(e.message||e))); }
    finally{ sendBtn.disabled=false; sendBtn.textContent='发送'; stopBtn.disabled=true; retryBtn.disabled=false; currentAbort=null; }
  }

  // Web search (Wikipedia zh, CORS OK)
  async function webSearch(){
    const q=(inputEl.value||'').trim()||lastUser; if(!q){ alert('请输入要搜索的内容'); return; }
    searchBtn.disabled=true; searchBtn.textContent='搜索中...';
    try{
      const url=`https://zh.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&utf8=&format=json&origin=*`;
      const r=await fetch(url); if(!r.ok) throw new Error('HTTP '+r.status);
      const j=await r.json(); const items=(j?.query?.search||[]).slice(0,5);
      if(items.length===0){ addMsg('assistant','未找到相关结果'); return; }
      const lines=items.map(it=>`- ${it.title}：https://zh.wikipedia.org/wiki/${encodeURIComponent(it.title)}\n  摘要：${(it.snippet||'').replace(/<[^>]+>/g,'')}`);
      const content=`搜索结果（来源：Wikipedia，仅供参考）\n${lines.join('\n')}`;
      addMsg('assistant', content);
      messages().push({ role:'system', content:`以下是与“${q}”相关的搜索结果：\n${lines.join('\n')}` }); saveSessions();
    }catch(e){ addMsg('assistant','搜索失败：'+(e.message||e)); }
    finally{ searchBtn.disabled=false; searchBtn.textContent='联网搜索'; }
  }

  // Enhance code blocks: detect lang, simple highlight, copy button
  function enhanceCodeBlocks(scope){ if(!scope) return; scope.querySelectorAll('pre > code').forEach(code=>{
      const pre=code.parentElement; const lang=(code.getAttribute('data-lang')||'').toLowerCase()||detectLang(code.innerText);
      code.innerHTML = highlight(code.innerText, lang);
      const wrap=document.createElement('div'); wrap.className='code-wrap'; pre.replaceWith(wrap); wrap.appendChild(pre);
      const btn=document.createElement('button'); btn.className='code-copy'; btn.textContent='复制代码'; btn.onclick=async()=>{ try{ await navigator.clipboard.writeText(code.innerText); btn.textContent='已复制'; setTimeout(()=>btn.textContent='复制代码',1200);}catch{} };
      wrap.appendChild(btn);
  }); }
  function detectLang(s){ try{ JSON.parse(s); return 'json'; }catch{} if(/#include\s+<|int\s+main\s*\(/.test(s)) return 'cpp'; if(/\b(def|import|from|class)\b/.test(s)) return 'python'; if(/<\/?[a-z!]/i.test(s)) return 'html'; if(/\b(function|const|let|=>|export|import)\b/.test(s)) return 'js'; if(/\bSELECT\b|\bFROM\b|\bWHERE\b/i.test(s)) return 'sql'; return 'text'; }
  function highlight(s,lang){ const esc=x=>x.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); s=esc(s); const apply=(re,cls)=> s=s.replace(re,`<span class="${cls}">$1</span>`); switch(lang){ case 'json': apply(/("[^"]*"\s*:)/g,'tok-attr'); apply(/"([^"\\]|\\.)*"/g,'tok-str'); apply(/\b(-?\d+(?:\.\d+)?)\b/g,'tok-num'); break; case 'js': apply(/\/\*[\s\S]*?\*\//g,'tok-com'); apply(/([^:]|^)\/\/.*$/gm,'tok-com'); apply(/\b(const|let|var|function|return|if|else|for|while|switch|case|break|class|extends|new|try|catch|finally|throw|import|from|export|default)\b/g,'tok-key'); apply(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g,'tok-str'); apply(/\b(-?\d+(?:\.\d+)?)\b/g,'tok-num'); break; case 'python': apply(/#.*$/gm,'tok-com'); apply(/\b(def|class|return|if|elif|else|for|while|try|except|finally|with|as|import|from|pass|break|continue|lambda|global|nonlocal|yield|in|is|and|or|not)\b/g,'tok-key'); apply(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g,'tok-str'); apply(/\b(-?\d+(?:\.\d+)?)\b/g,'tok-num'); break; case 'html': s=s.replace(/(&lt;\/?)([a-zA-Z0-9\-]+)([^&]*?&gt;)/g,(m,a,t,rest)=>`${a}<span class="tok-tag">${t}</span>${rest}`); break; case 'cpp': apply(/\/\*[\s\S]*?\*\//g,'tok-com'); apply(/([^:]|^)\/\/.*$/gm,'tok-com'); apply(/\b(int|float|double|char|void|return|if|else|for|while|class|struct|public|private|protected|include|define)\b/g,'tok-key'); apply(/\b(-?\d+(?:\.\d+)?)\b/g,'tok-num'); break; case 'sql': apply(/\b(SELECT|FROM|WHERE|JOIN|ON|GROUP BY|ORDER BY|INSERT|INTO|VALUES|UPDATE|SET|DELETE)\b/gi,'tok-key'); apply(/'(?:[^'\\]|\\.)*'/g,'tok-str'); break; default: break; } return s; }

  // Event wires
  sendBtn?.addEventListener('click', send);
  inputEl?.addEventListener('keydown', (e)=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); } });
  stopBtn?.addEventListener('click', ()=>{ try{ currentAbort?.abort(); }catch{} });
  retryBtn?.addEventListener('click', ()=>{ if(lastUser){ inputEl.value=lastUser; send(); } });
  clearBtn?.addEventListener('click', ()=>{ msgsEl.innerHTML=''; messages().length=0; saveSessions(); });
  exportBtn?.addEventListener('click', ()=>{ const data={ name:sessions[currentId].name, model:modelEl?.value||'', system: systemPrompt(), messages: messages() }; const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`chat-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); });
  importInput?.addEventListener('change', async ()=>{ const f=importInput.files?.[0]; if(!f) return; try{ const t=await f.text(); const j=JSON.parse(t); const id='s'+Date.now(); sessions[id]={ name: j.name||('导入-'+new Date().toLocaleString()), system: j.system||'', messages: Array.isArray(j.messages)?j.messages:[] }; saveSessions(); switchSession(id); alert('已导入并创建新会话'); }catch{ alert('导入失败'); } });
  sessionSel?.addEventListener('change', ()=> switchSession(sessionSel.value));
  sessionAddBtn?.addEventListener('click', ()=>{ const id='s'+Date.now(); sessions[id]={ name:'新会话', system:'', messages:[] }; saveSessions(); switchSession(id); });
  sessionRenBtn?.addEventListener('click', ()=>{ const name=prompt('重命名会话：', sessions[currentId].name||''); if(name){ sessions[currentId].name=name; saveSessions(); renderSessionOptions(); } });
  sessionDelBtn?.addEventListener('click', ()=>{ if(Object.keys(sessions).length<=1){ alert('至少保留一个会话'); return; } if(confirm('删除当前会话？')){ delete sessions[currentId]; saveSessions(); currentId=Object.keys(sessions)[0]; renderSessionOptions(); renderAllMessages(); } });
  multiSelBtn?.addEventListener('click', toggleSelecting);
  multiCopyBtn?.addEventListener('click', async ()=>{ if(selection.size===0){ alert('未选择消息'); return;} const texts=Array.from(selection).map(div=>div.querySelector('.body')?.innerText||''); try{ await navigator.clipboard.writeText(texts.join('\n\n')); alert('已复制'); }catch{ alert('复制失败'); } });
  multiDelBtn?.addEventListener('click', ()=>{ if(selection.size===0){ alert('未选择消息'); return;} const nodes=Array.from(selection); const idxs=nodes.map(div=>Array.prototype.indexOf.call(msgsEl.children, div)).sort((a,b)=>b-a); const arr=messages(); for(const i of idxs){ arr.splice(i,1);} saveSessions(); selection.clear(); renderAllMessages(); });
  searchBtn?.addEventListener('click', webSearch);

  // Initial render
  renderAllMessages();
})();

