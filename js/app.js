/**
 * nXuu Trading Journal — app.js v5.0
 * Auth + Checklist + Log + Calendar + Equity + Stats + Settings
 */

'use strict';

// ── STATE ─────────────────────────────────────────────────────
let allTrades      = [];
let userSteps      = [];
let userModels     = [];
let calYear        = new Date().getFullYear();
let calMonth       = new Date().getMonth() + 1;
let equityChart    = null;
let selectedResult = null;

// ── AUDIO ─────────────────────────────────────────────────────
const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
let audioCtx = null, audioUnlocked = false;

function getAudioCtx() { if (!audioCtx) audioCtx = new AudioCtxClass(); return audioCtx; }

function withAudio(fn) {
  try { const c = getAudioCtx(); c.state === 'suspended' ? c.resume().then(fn).catch(()=>{}) : fn(); } catch(e) {}
}

function unlockAudio() {
  if (audioUnlocked) return; audioUnlocked = true;
  try { const c=getAudioCtx(),b=c.createBuffer(1,1,22050),s=c.createBufferSource(); s.buffer=b; s.connect(c.destination); s.start(0); if(c.state==='suspended')c.resume(); } catch(e) {}
}

function playTick() {
  withAudio(()=>{ try { const c=getAudioCtx(),o=c.createOscillator(),g=c.createGain(); o.connect(g);g.connect(c.destination); o.type='sine';o.frequency.value=600; g.gain.setValueAtTime(0.18,c.currentTime); g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.12); o.start();o.stop(c.currentTime+0.12); } catch(e){} });
}

function playUncheck() {
  withAudio(()=>{ try { const c=getAudioCtx(),o=c.createOscillator(),g=c.createGain(); o.connect(g);g.connect(c.destination); o.type='sine';o.frequency.value=350; g.gain.setValueAtTime(0.1,c.currentTime); g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.1); o.start();o.stop(c.currentTime+0.1); } catch(e){} });
}

function playFanfare() {
  withAudio(()=>{ try { const c=getAudioCtx(); [523,659,784,1047].forEach((f,i)=>{ const o=c.createOscillator(),g=c.createGain(); o.connect(g);g.connect(c.destination); o.type='sine';o.frequency.value=f; const s=c.currentTime+i*0.12; g.gain.setValueAtTime(0,s);g.gain.linearRampToValueAtTime(0.22,s+0.02);g.gain.exponentialRampToValueAtTime(0.001,s+0.3); o.start(s);o.stop(s+0.3); }); } catch(e){} });
}

// ── CONFETTI ──────────────────────────────────────────────────
const CC = ['#6b7a52','#8a9a6a','#c8d4b0','#a08040','#c8a84b','#4a6a8a','#6a4a8a','#f2ede4','#1e1c18'];

function fireConfetti() {
  const c = document.getElementById('confetti-container');
  c.innerHTML = '';
  for (let i=0;i<90;i++) {
    const p=document.createElement('div'); p.className='confetti-piece';
    const sz=Math.random()*8+5,rect=Math.random()>.5;
    p.style.cssText=`left:${Math.random()*100}vw;width:${sz}px;height:${rect?sz*2.5:sz}px;background:${CC[Math.floor(Math.random()*CC.length)]};border-radius:${rect?'2px':'50%'};animation-delay:${Math.random()*.6}s;animation-duration:${Math.random()*1.5+1.8}s;--drift:${Math.random()*140-70}px;--rotate:${Math.random()*720-360}deg;`;
    c.appendChild(p);
  }
  setTimeout(()=>{c.innerHTML='';},5000);
}

// ── AUTH ──────────────────────────────────────────────────────
function showAuthTab(tab) {
  document.getElementById('auth-signin').style.display = tab==='signin'?'block':'none';
  document.getElementById('auth-signup').style.display = tab==='signup'?'block':'none';
  document.getElementById('tab-signin-btn').classList.toggle('active', tab==='signin');
  document.getElementById('tab-signup-btn').classList.toggle('active', tab==='signup');
}

async function handleSignIn() {
  const email = document.getElementById('si-email').value.trim();
  const pass  = document.getElementById('si-pass').value;
  const msg   = document.getElementById('signin-msg');
  const btn   = document.getElementById('signin-btn');

  if (!email || !pass) return setAuthMsg(msg, 'Please fill in all fields.', 'error');
  if (!isConfigured()) return setAuthMsg(msg, 'Add your Supabase keys to js/supabase.js first.', 'error');

  btn.disabled = true; btn.textContent = 'Signing in...';
  try {
    await signIn(email, pass);
    await bootApp();
  } catch(e) {
    setAuthMsg(msg, e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Sign In';
  }
}

async function handleSignUp() {
  const email = document.getElementById('su-email').value.trim();
  const pass  = document.getElementById('su-pass').value;
  const pass2 = document.getElementById('su-pass2').value;
  const msg   = document.getElementById('signup-msg');
  const btn   = document.getElementById('signup-btn');

  if (!email || !pass || !pass2) return setAuthMsg(msg, 'Please fill in all fields.', 'error');
  if (pass !== pass2)            return setAuthMsg(msg, 'Passwords do not match.', 'error');
  if (pass.length < 6)           return setAuthMsg(msg, 'Password must be at least 6 characters.', 'error');
  if (!isConfigured())           return setAuthMsg(msg, 'Add your Supabase keys to js/supabase.js first.', 'error');

  btn.disabled = true; btn.textContent = 'Creating account...';
  try {
    await signUp(email, pass);
    setAuthMsg(msg, 'Account created! Please check your email to confirm, then sign in.', 'success');
    setTimeout(() => showAuthTab('signin'), 2500);
  } catch(e) {
    setAuthMsg(msg, e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Create Account';
  }
}

async function handleSignOut() {
  await signOut();
  document.getElementById('main-app').style.display   = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  allTrades = []; userSteps = []; userModels = [];
}

function setAuthMsg(el, text, type) {
  el.textContent = text;
  el.className   = `auth-msg ${type}`;
}

// ── BOOT ──────────────────────────────────────────────────────
async function bootApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('main-app').style.display    = 'flex';

  const email = getUserEmail();
  document.getElementById('user-email').textContent    = email;
  document.getElementById('settings-email').textContent = email;

  await Promise.all([ loadTrades(), loadSteps(), loadModels() ]);
}

// ── TABS ──────────────────────────────────────────────────────
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabName);
    b.setAttribute('aria-selected', b.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-pane').forEach(p => {
    p.classList.toggle('active', p.id === `tab-${tabName}`);
  });
  if (tabName === 'calendar') renderCalendar();
  if (tabName === 'equity')   renderEquity();
  if (tabName === 'stats')    renderStats();
  if (tabName === 'settings') renderSettings();
}

// ── CHECKLIST ─────────────────────────────────────────────────
async function loadSteps() {
  try {
    userSteps = await fetchSteps();
  } catch(e) {
    userSteps = [];
  }
  renderChecklist();
}

function renderChecklist() {
  const wrap = document.getElementById('checklist-steps-wrap');
  const total = userSteps.length;
  document.getElementById('prog-big').innerHTML = `0<span> / ${total}</span>`;

  if (total === 0) {
    wrap.innerHTML = `<div class="empty-state">No checklist steps yet.<br>Add them in Settings.</div>`;
    return;
  }

  // Group by section
  const sections = {};
  userSteps.forEach(s => {
    if (!sections[s.section]) sections[s.section] = [];
    sections[s.section].push(s);
  });

  const sectionColors = ['olive','blue','amber','purple','rose','teal','slate','brown'];
  let sIdx = 0;
  let html = '';

  Object.entries(sections).forEach(([sectionName, steps]) => {
    const color = sectionColors[sIdx % sectionColors.length];
    sIdx++;
    html += `
      <section class="section" data-color="${color}">
        <div class="sec-label">
          <div class="sec-icon">${String(sIdx).padStart(2,'0')}</div>
          <h2 class="sec-name">${sectionName}</h2>
          <div class="sec-rule"></div>
        </div>
        <ul class="steps-wrap">
          ${steps.map((step, i) => `
            <li class="step" data-id="${step.id}" onclick="tog(this)" tabindex="0" onkeydown="handleKey(event,this)">
              <div class="step-left-bar"></div>
              <span class="step-num">${String(userSteps.indexOf(step)+1).padStart(2,'0')}</span>
              <div class="step-body">
                <span class="step-cat">${sectionName}</span>
                <p class="step-title">${step.title}</p>
              </div>
              <div class="step-cb">
                <svg class="cb-svg" width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.8 7L9 1" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </li>
          `).join('')}
        </ul>
      </section>`;
  });

  wrap.innerHTML = html;
  updateChecklistProgress();
}

function tog(el) {
  unlockAudio();
  el.classList.toggle('checked');
  const checked = el.classList.contains('checked');
  el.setAttribute('aria-checked', checked);
  el.classList.remove('bounce'); void el.offsetWidth; el.classList.add('bounce');
  checked ? playTick() : playUncheck();
  updateChecklistProgress();
}

function handleKey(e, el) {
  if (e.key==='Enter'||e.key===' ') { e.preventDefault(); tog(el); }
}

function updateChecklistProgress() {
  const total = userSteps.length;
  const done  = document.querySelectorAll('.step.checked').length;
  document.getElementById('prog-big').innerHTML = `${done}<span> / ${total}</span>`;
  document.getElementById('fill').style.width   = total > 0 ? `${Math.round(done/total*100)}%` : '0%';
  const banner = document.getElementById('complete-banner');
  if (total > 0 && done === total) {
    banner.classList.add('visible'); fireConfetti(); playFanfare();
  } else {
    banner.classList.remove('visible');
  }
}

function resetChecklist() {
  document.querySelectorAll('.step').forEach(s => {
    s.classList.remove('checked','bounce');
    s.setAttribute('aria-checked','false');
  });
  updateChecklistProgress();
}

// ── MODELS (for form dropdown) ────────────────────────────────
async function loadModels() {
  try {
    userModels = await fetchModels();
  } catch(e) {
    userModels = [];
  }
  populateModelDropdown();
}

function populateModelDropdown() {
  const sel = document.getElementById('f-model');
  if (!sel) return;
  sel.innerHTML = `<option value="">Select...</option>` +
    userModels.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
}

// ── TRADE LOG ─────────────────────────────────────────────────
function initForm() {
  document.getElementById('f-date').value = new Date().toISOString().split('T')[0];
  document.querySelectorAll('.result-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.result-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedResult = btn.dataset.value;
    });
  });
}

async function submitTrade() {
  const date    = document.getElementById('f-date').value;
  const session = document.getElementById('f-session').value;
  const model   = document.getElementById('f-model').value;
  const rRaw    = document.getElementById('f-r').value;
  const pnlRaw  = document.getElementById('f-pnl').value;
  const notes   = document.getElementById('f-notes').value.trim();
  const btn     = document.getElementById('submitBtn');
  const btnText = document.getElementById('submit-text');

  if (!date)           return showFormMsg('Please select a date.', 'error');
  if (!selectedResult) return showFormMsg('Please select Win, Loss, or BE.', 'error');
  if (rRaw===''&&pnlRaw==='') return showFormMsg('Please enter at least an R value or PnL.', 'error');

  btn.disabled = true; btnText.textContent = 'Saving...';

  try {
    await insertTrade({
      date,
      result:   selectedResult,
      r_value:  rRaw  !== '' ? parseFloat(rRaw)  : 0,
      pnl_usd:  pnlRaw!== '' ? parseFloat(pnlRaw): 0,
      notes:    notes  || null,
      model:    model  || null,
      session:  session|| null,
    });
    showFormMsg('Trade saved!', 'success');
    resetForm();
    await loadTrades();
  } catch(e) {
    showFormMsg('Failed to save. Check your connection.', 'error');
    console.error(e);
  } finally {
    btn.disabled = false; btnText.textContent = 'Save Trade';
  }
}

function resetForm() {
  document.getElementById('f-date').value    = new Date().toISOString().split('T')[0];
  document.getElementById('f-session').value = '';
  document.getElementById('f-model').value   = '';
  document.getElementById('f-r').value       = '';
  document.getElementById('f-pnl').value     = '';
  document.getElementById('f-notes').value   = '';
  document.querySelectorAll('.result-btn').forEach(b => b.classList.remove('selected'));
  selectedResult = null;
}

function showFormMsg(text, type) {
  const el = document.getElementById('form-msg');
  el.textContent = text; el.className = `form-msg ${type}`;
  setTimeout(() => { el.textContent=''; el.className='form-msg'; }, 4000);
}

async function loadTrades() {
  const listEl = document.getElementById('trade-list');
  try {
    allTrades = await fetchAllTrades();
    renderTradeList();
  } catch(e) {
    listEl.innerHTML = `<div class="empty-state">Could not load trades.</div>`;
    console.error(e);
  }
}

function renderTradeList() {
  const listEl = document.getElementById('trade-list');
  if (allTrades.length === 0) {
    listEl.innerHTML = `<div class="empty-state">No trades yet. Log your first trade above.</div>`;
    return;
  }
  listEl.innerHTML = allTrades.slice(0,60).map(t => {
    const rDisplay   = t.r_value  ? (t.r_value>0?`+${t.r_value}R`:`${t.r_value}R`) : '';
    const pnlDisplay = t.pnl_usd  ? (t.pnl_usd>0?`+$${t.pnl_usd.toFixed(2)}`:`-$${Math.abs(t.pnl_usd).toFixed(2)}`) : '';
    const dateStr    = new Date(t.date+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
    return `
      <div class="trade-row">
        <div class="trade-row-left">
          <div class="trade-row-top">
            <span class="trade-result ${t.result}">${t.result.toUpperCase()}</span>
            <span class="trade-date">${dateStr}</span>
            ${t.model   ?`<span class="trade-tag">${t.model}</span>`  :''}
            ${t.session ?`<span class="trade-tag">${t.session}</span>`:''}
          </div>
          ${t.notes?`<p class="trade-notes">${t.notes}</p>`:''}
        </div>
        <div class="trade-row-right">
          <div class="trade-values">
            ${rDisplay  ?`<span class="trade-r ${t.result}">${rDisplay}</span>`  :''}
            ${pnlDisplay?`<span class="trade-pnl ${t.pnl_usd>=0?'win':'loss'}">${pnlDisplay}</span>`:''}
          </div>
          <button class="delete-btn" onclick="confirmDelete('${t.id}')" type="button">✕</button>
        </div>
      </div>`;
  }).join('');
}

async function confirmDelete(id) {
  if (!confirm('Delete this trade?')) return;
  try { await deleteTrade(id); await loadTrades(); }
  catch(e) { alert('Could not delete trade.'); }
}

// ── CALENDAR ──────────────────────────────────────────────────
async function renderCalendar() {
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('cal-month-label').textContent = `${MONTHS[calMonth-1]} ${calYear}`;
  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '<div class="cal-loading">Loading...</div>';

  let trades = [];
  try { trades = await fetchTradesByMonth(calYear, calMonth); } catch(e) { console.error(e); }

  const tradeMap = {};
  trades.forEach(t => {
    if (!tradeMap[t.date]) tradeMap[t.date] = [];
    tradeMap[t.date].push(t);
  });

  // Summary
  const totalPnl = trades.reduce((s,t) => s+(t.pnl_usd||0), 0);
  const wins     = trades.filter(t=>t.result==='win').length;
  const wr       = trades.length>0 ? Math.round(wins/trades.length*100) : 0;

  const pnlEl = document.getElementById('cal-pnl');
  pnlEl.textContent = trades.length>0 ? (totalPnl>=0?`+$${totalPnl.toFixed(0)}`:`-$${Math.abs(totalPnl).toFixed(0)}`) : '—';
  pnlEl.className   = `cal-stat-val ${totalPnl>=0?'win-col':'loss-col'}`;
  document.getElementById('cal-trades').textContent = trades.length||'—';
  document.getElementById('cal-wr').textContent     = trades.length>0?`${wr}%`:'—';

  const firstDay    = new Date(calYear,calMonth-1,1).getDay();
  const daysInMonth = new Date(calYear,calMonth,0).getDate();
  const today       = new Date().toISOString().split('T')[0];

  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let html = DAYS.map(d=>`<div class="cal-day-hd">${d}</div>`).join('');
  for (let i=0;i<firstDay;i++) html+=`<div class="cal-cell empty"></div>`;

  for (let d=1;d<=daysInMonth;d++) {
    const ds  = `${calYear}-${String(calMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dts = tradeMap[ds]||[];
    const isToday = ds===today;
    const dayPnl  = dts.reduce((s,t)=>s+(t.pnl_usd||0),0);
    const count   = dts.length;

    let cls = 'cal-cell';
    if (isToday) cls+=' today';
    if (count>0) {
      const hasWin  = dts.some(t=>t.result==='win');
      const hasLoss = dts.some(t=>t.result==='loss');
      const allBE   = dts.every(t=>t.result==='be');
      if (allBE)               cls+=' be';
      else if (hasWin&&!hasLoss) cls+=' win';
      else if (hasLoss&&!hasWin) cls+=' loss';
      else                       cls+=' mixed';
    }

    const pnlLabel  = count>0 ? `<span class="cal-pnl-val ${dayPnl>=0?'pos':'neg'}">${dayPnl>=0?'+':''}$${Math.abs(dayPnl).toFixed(0)}</span>` : '';
    const cntLabel  = count>0 ? `<span class="cal-count">${count} trade${count>1?'s':''}</span>` : '';

    html+=`<div class="${cls}"><span class="cal-day-num">${d}</span>${pnlLabel}${cntLabel}</div>`;
  }

  grid.innerHTML = html;
}

// ── EQUITY CURVE ($) ──────────────────────────────────────────
function renderEquity() {
  const emptyEl = document.getElementById('equity-empty');
  const canvas  = document.getElementById('equity-chart');

  if (allTrades.length === 0) {
    emptyEl.style.display = 'flex'; canvas.style.display = 'none';
    ['eq-total','eq-best','eq-worst','eq-dd'].forEach(id => { document.getElementById(id).textContent='—'; });
    return;
  }

  emptyEl.style.display = 'none'; canvas.style.display = 'block';

  const sorted = [...allTrades].sort((a,b)=>new Date(a.date)-new Date(b.date));
  const labels = [], data = [];
  let cum = 0;

  sorted.forEach(t => {
    cum += t.pnl_usd||0;
    labels.push(new Date(t.date+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'}));
    data.push(parseFloat(cum.toFixed(2)));
  });

  const pnlVals = sorted.map(t=>t.pnl_usd||0);
  const total   = cum;
  const best    = Math.max(...pnlVals);
  const worst   = Math.min(...pnlVals);

  let peak=0, maxDD=0;
  data.forEach(v=>{ if(v>peak)peak=v; const dd=peak-v; if(dd>maxDD)maxDD=dd; });

  const fmt = v => v>=0 ? `+$${v.toFixed(2)}` : `-$${Math.abs(v).toFixed(2)}`;

  document.getElementById('eq-total').textContent  = fmt(total);
  document.getElementById('eq-total').className    = `equity-stat-val ${total>=0?'win-col':'loss-col'}`;
  document.getElementById('eq-best').textContent   = fmt(best);
  document.getElementById('eq-worst').textContent  = fmt(worst);
  document.getElementById('eq-dd').textContent     = `-$${maxDD.toFixed(2)}`;

  if (equityChart) equityChart.destroy();
  const col = total>=0 ? '#6b7a52' : '#8a4a4a';

  equityChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data, borderColor: col, borderWidth: 2,
        pointRadius: 3, pointBackgroundColor: col,
        fill: true,
        backgroundColor: total>=0 ? 'rgba(107,122,82,0.08)' : 'rgba(138,74,74,0.08)',
        tension: 0.3,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => fmt(ctx.raw) } }
      },
      scales: {
        x: { ticks:{ color:'#8a8478',font:{size:10,family:'DM Mono'},maxTicksLimit:8,maxRotation:0 }, grid:{ color:'rgba(0,0,0,0.04)' } },
        y: { ticks:{ color:'#8a8478',font:{size:10,family:'DM Mono'},callback: v=>v>=0?`+$${v}`:`-$${Math.abs(v)}` }, grid:{ color:'rgba(0,0,0,0.04)' } }
      }
    }
  });
}

// ── STATS ─────────────────────────────────────────────────────
function renderStats() {
  if (allTrades.length === 0) {
    ['st-total','st-wr','st-avgr','st-totalpnl','st-wins','st-losses'].forEach(id=>{document.getElementById(id).textContent='—';});
    document.getElementById('model-stats').innerHTML   = `<div class="empty-state">No trades yet.</div>`;
    document.getElementById('session-stats').innerHTML = `<div class="empty-state">No trades yet.</div>`;
    return;
  }

  const wins    = allTrades.filter(t=>t.result==='win').length;
  const losses  = allTrades.filter(t=>t.result==='loss').length;
  const total   = allTrades.length;
  const totalPnl= allTrades.reduce((s,t)=>s+(t.pnl_usd||0),0);
  const totalR  = allTrades.reduce((s,t)=>s+(t.r_value||0),0);
  const wr      = Math.round(wins/total*100);
  const avgR    = totalR/total;

  document.getElementById('st-total').textContent   = total;
  document.getElementById('st-wr').textContent      = `${wr}%`;
  document.getElementById('st-avgr').textContent    = `${avgR>=0?'+':''}${avgR.toFixed(2)}R`;
  document.getElementById('st-totalpnl').textContent= totalPnl>=0?`+$${totalPnl.toFixed(2)}`:`-$${Math.abs(totalPnl).toFixed(2)}`;
  document.getElementById('st-wins').textContent    = wins;
  document.getElementById('st-losses').textContent  = losses;
  document.getElementById('st-avgr').className      = `stat-val ${avgR>=0?'win-col':'loss-col'}`;
  document.getElementById('st-totalpnl').className  = `stat-val ${totalPnl>=0?'win-col':'loss-col'}`;

  const buildPerfRows = (groupKey, elId) => {
    const groups = {};
    allTrades.forEach(t => {
      const k = t[groupKey] ? (t[groupKey].charAt(0).toUpperCase()+t[groupKey].slice(1)) : 'Other';
      if (!groups[k]) groups[k]={wins:0,losses:0,be:0,pnl:0};
      groups[k][t.result==='win'?'wins':t.result==='loss'?'losses':'be']++;
      groups[k].pnl += t.pnl_usd||0;
    });
    document.getElementById(elId).innerHTML = Object.entries(groups).map(([name,d])=>{
      const t=d.wins+d.losses+d.be, w=t>0?Math.round(d.wins/t*100):0;
      const pnlStr = d.pnl>=0?`+$${d.pnl.toFixed(2)}`:`-$${Math.abs(d.pnl).toFixed(2)}`;
      return `<div class="perf-row">
        <div class="perf-name">${name}</div>
        <div class="perf-meta">
          <span class="perf-wr">${w}% WR</span>
          <span class="perf-r ${d.pnl>=0?'win-col':'loss-col'}">${pnlStr}</span>
          <span class="perf-count">${t} trades</span>
        </div>
      </div>`;
    }).join('');
  };

  buildPerfRows('model',   'model-stats');
  buildPerfRows('session', 'session-stats');
}

// ── SETTINGS ──────────────────────────────────────────────────
function renderSettings() {
  // Steps list
  const stepsEl = document.getElementById('steps-manage-list');
  if (userSteps.length === 0) {
    stepsEl.innerHTML = `<div class="empty-state">No steps yet.</div>`;
  } else {
    stepsEl.innerHTML = userSteps.map(s=>`
      <div class="manage-row">
        <div class="manage-row-info">
          <span class="manage-row-section">${s.section}</span>
          <span class="manage-row-title">${s.title}</span>
        </div>
        <button class="delete-btn" onclick="removeStep('${s.id}')" type="button">✕</button>
      </div>`).join('');
  }

  // Models list
  const modelsEl = document.getElementById('models-manage-list');
  if (userModels.length === 0) {
    modelsEl.innerHTML = `<div class="empty-state">No models yet.</div>`;
  } else {
    modelsEl.innerHTML = userModels.map(m=>`
      <div class="manage-row">
        <div class="manage-row-info">
          <span class="manage-row-title">${m.name}</span>
        </div>
        <button class="delete-btn" onclick="removeModel('${m.id}')" type="button">✕</button>
      </div>`).join('');
  }
}

async function addStep() {
  const section = document.getElementById('new-step-section').value.trim();
  const title   = document.getElementById('new-step-title').value.trim();
  if (!section || !title) return alert('Please fill in both section and title.');
  try {
    await insertStep(section, title, userSteps.length);
    document.getElementById('new-step-section').value = '';
    document.getElementById('new-step-title').value   = '';
    await loadSteps();
    renderSettings();
  } catch(e) { alert('Could not add step.'); }
}

async function removeStep(id) {
  if (!confirm('Delete this step?')) return;
  try {
    await deleteStep(id);
    await loadSteps();
    renderSettings();
  } catch(e) { alert('Could not delete step.'); }
}

async function addModel() {
  const name = document.getElementById('new-model-name').value.trim();
  if (!name) return alert('Please enter a model name.');
  try {
    await insertModel(name);
    document.getElementById('new-model-name').value = '';
    await loadModels();
    renderSettings();
  } catch(e) { alert('Could not add model.'); }
}

async function removeModel(id) {
  if (!confirm('Delete this model?')) return;
  try {
    await deleteModel(id);
    await loadModels();
    renderSettings();
  } catch(e) { alert('Could not delete model.'); }
}

// ── EXPORT CSV ────────────────────────────────────────────────
function exportCSV() {
  if (allTrades.length === 0) return alert('No trades to export.');
  const headers = ['Date','Result','R Value','PnL (USD)','Model','Session','Notes'];
  const rows    = allTrades.map(t => [
    t.date, t.result, t.r_value||'', t.pnl_usd||'',
    t.model||'', t.session||'', (t.notes||'').replace(/,/g,' ')
  ]);
  const csv = [headers, ...rows].map(r=>r.join(',')).join('\n');
  const a   = document.createElement('a');
  a.href    = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download= `nxuu-trades-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Checklist reset
  document.getElementById('resetBtn').addEventListener('click', resetChecklist);

  // Log form
  initForm();
  document.getElementById('submitBtn').addEventListener('click', submitTrade);
  document.getElementById('refreshBtn').addEventListener('click', loadTrades);

  // Calendar nav
  document.getElementById('cal-prev').addEventListener('click', () => {
    calMonth--; if(calMonth<1){calMonth=12;calYear--;} renderCalendar();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    calMonth++; if(calMonth>12){calMonth=1;calYear++;} renderCalendar();
  });

  // iOS audio
  document.addEventListener('touchstart', unlockAudio, {once:true,passive:true});
  document.addEventListener('touchend',   unlockAudio, {once:true,passive:true});

  // Auth restore
  if (!isConfigured()) {
    document.getElementById('auth-screen').style.display = 'flex';
    return;
  }

  // Handle Supabase email confirmation redirect (tokens arrive in the URL hash)
  const hash = window.location.hash;
  if (hash && hash.includes('access_token')) {
    const params      = new URLSearchParams(hash.replace('#', ''));
    const accessToken = params.get('access_token');
    const refreshToken= params.get('refresh_token');
    const type        = params.get('type');
    if (accessToken) {
      try {
        await setSessionFromTokens(accessToken, refreshToken);
        history.replaceState(null, '', window.location.pathname);
        if (type === 'signup') {
          showAuthTab('signin');
          setAuthMsg(document.getElementById('signin-msg'), 'Email confirmed! Signing you in…', 'success');
        }
        await bootApp();
        return;
      } catch(e) {
        console.error('Token restore failed:', e);
      }
    }
  }

  if (restoreSession()) {
    await bootApp();
  } else {
    document.getElementById('auth-screen').style.display = 'flex';
  }
});
