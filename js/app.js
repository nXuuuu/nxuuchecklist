/**
 * nXuu Trading Journal — app.js (FIXED & SECURE v6.1)
 * Features: Trade detail view, Filter history, Leaderboard, Dark mode, Password reset
 * Security fixes: XSS prevention, input validation, rate limiting, strong passwords
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
let activeFilters  = { result:'', session:'', model:'', account:'', from:'', to:'' };
let activeAccount  = ''; // '' = all accounts

// ── DARK MODE ─────────────────────────────────────────────────
function initDarkMode() {
  const saved = localStorage.getItem('nxuu_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = saved ? saved === 'dark' : prefersDark;
  applyTheme(isDark);
}

function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const toggleBtn = document.getElementById('dark-toggle-btn');
  const settingsToggle = document.getElementById('dark-mode-toggle');
  if (toggleBtn) toggleBtn.textContent = dark ? '☀' : '☾';
  if (settingsToggle) settingsToggle.checked = dark;
  localStorage.setItem('nxuu_theme', dark ? 'dark' : 'light');
}

function toggleDark() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  applyTheme(!isDark);
  const settingsToggle = document.getElementById('dark-mode-toggle');
  if (settingsToggle) settingsToggle.checked = !isDark;
}

// ── AUDIO ─────────────────────────────────────────────────────
const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
let audioCtx = null, audioUnlocked = false;
function getAudioCtx() { if (!audioCtx) audioCtx = new AudioCtxClass(); return audioCtx; }
function withAudio(fn) { try { const c=getAudioCtx(); c.state==='suspended'?c.resume().then(fn).catch(()=>{}):fn(); } catch(e){} }
function unlockAudio() { if(audioUnlocked)return;audioUnlocked=true;try{const c=getAudioCtx(),b=c.createBuffer(1,1,22050),s=c.createBufferSource();s.buffer=b;s.connect(c.destination);s.start(0);if(c.state==='suspended')c.resume();}catch(e){} }
function playTick()    { withAudio(()=>{try{const c=getAudioCtx(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type='sine';o.frequency.value=600;g.gain.setValueAtTime(0.18,c.currentTime);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.12);o.start();o.stop(c.currentTime+0.12);}catch(e){}});}
function playUncheck() { withAudio(()=>{try{const c=getAudioCtx(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type='sine';o.frequency.value=350;g.gain.setValueAtTime(0.1,c.currentTime);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.1);o.start();o.stop(c.currentTime+0.1);}catch(e){}});}
function playFanfare() { withAudio(()=>{try{const c=getAudioCtx();[523,659,784,1047].forEach((f,i)=>{const o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type='sine';o.frequency.value=f;const s=c.currentTime+i*0.12;g.gain.setValueAtTime(0,s);g.gain.linearRampToValueAtTime(0.22,s+0.02);g.gain.exponentialRampToValueAtTime(0.001,s+0.3);o.start(s);o.stop(s+0.3);});}catch(e){}});}

// ── CONFETTI ──────────────────────────────────────────────────
const CC=['#6b7a52','#8a9a6a','#c8d4b0','#a08040','#c8a84b','#4a6a8a','#6a4a8a','#f2ede4','#1e1c18'];
function fireConfetti() {
  const c=document.getElementById('confetti-container'); c.innerHTML='';
  for(let i=0;i<90;i++){const p=document.createElement('div');p.className='confetti-piece';const sz=Math.random()*8+5,rect=Math.random()>.5;p.style.cssText=`left:${Math.random()*100}vw;width:${sz}px;height:${rect?sz*2.5:sz}px;background:${CC[Math.floor(Math.random()*CC.length)]};border-radius:${rect?'2px':'50%'};animation-delay:${Math.random()*.6}s;animation-duration:${Math.random()*1.5+1.8}s;--drift:${Math.random()*140-70}px;--rotate:${Math.random()*720-360}deg;`;c.appendChild(p);}
  setTimeout(()=>{c.innerHTML='';},5000);
}

// ── AUTH ──────────────────────────────────────────────────────
function showAuthTab(tab) {
  document.getElementById('auth-signin').style.display = tab==='signin'?'block':'none';
  document.getElementById('auth-signup').style.display = tab==='signup'?'block':'none';
  document.getElementById('tab-signin-btn').classList.toggle('active', tab==='signin');
  document.getElementById('tab-signup-btn').classList.toggle('active', tab==='signup');
}

function showResetPanel() {
  document.getElementById('auth-signin-signup').style.display = 'none';
  document.getElementById('auth-reset').style.display = 'block';
}

function hideResetPanel() {
  document.getElementById('auth-reset').style.display = 'none';
  document.getElementById('auth-signin-signup').style.display = 'block';
}

async function handlePasswordReset() {
  const email = document.getElementById('reset-email').value.trim();
  const msg   = document.getElementById('reset-msg');
  const btn   = document.getElementById('reset-btn');
  if (!email) return setAuthMsg(msg, 'Please enter your email.', 'error');
  
  // Validate email
  const emailError = Validators.email(email);
  if (emailError) return setAuthMsg(msg, emailError, 'error');
  
  btn.disabled = true; btn.textContent = 'Sending...';
  try {
    await requestPasswordReset(email);
    setAuthMsg(msg, 'Reset link sent! Check your inbox.', 'success');
  } catch(e) {
    setAuthMsg(msg, e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Send Reset Link';
  }
}

async function handleSignIn() {
  const email = document.getElementById('si-email').value.trim();
  const pass  = document.getElementById('si-pass').value;
  const msg   = document.getElementById('signin-msg');
  const btn   = document.getElementById('signin-btn');
  
  if (!email || !pass) return setAuthMsg(msg, 'Please fill in all fields.', 'error');
  if (!isConfigured()) return setAuthMsg(msg, 'Add your Supabase keys to environment variables first.', 'error');
  
  btn.disabled=true; btn.textContent='Signing in...';
  try {
    await signIn(email, pass);
    await bootApp();
  }
  catch(e) {
    setAuthMsg(msg, e.message, 'error');
  }
  finally {
    btn.disabled=false; btn.textContent='Sign In';
  }
}

async function handleSignUp() {
  const email = document.getElementById('su-email').value.trim();
  const pass  = document.getElementById('su-pass').value;
  const pass2 = document.getElementById('su-pass2').value;
  const msg   = document.getElementById('signup-msg');
  const btn   = document.getElementById('signup-btn');
  
  if (!email||!pass||!pass2) return setAuthMsg(msg,'Please fill in all fields.','error');
  
  // Validate email
  const emailError = Validators.email(email);
  if (emailError) return setAuthMsg(msg, emailError, 'error');
  
  // Validate passwords match
  const matchError = Validators.passwordsMatch(pass, pass2);
  if (matchError) return setAuthMsg(msg, matchError, 'error');
  
  // Validate password strength
  const passError = Validators.password(pass);
  if (passError) return setAuthMsg(msg, passError, 'error');
  
  if (!isConfigured()) return setAuthMsg(msg,'Add your Supabase keys to environment variables first.','error');
  
  btn.disabled=true; btn.textContent='Creating account...';
  try {
    await signUp(email, pass);
    setAuthMsg(msg,'Account created! Check your email to confirm, then sign in.','success');
    setTimeout(()=>showAuthTab('signin'),2500);
  }
  catch(e) {
    setAuthMsg(msg, e.message, 'error');
  }
  finally {
    btn.disabled=false; btn.textContent='Create Account';
  }
}

async function handleSignOut() {
  await signOut();
  activeAccount = '';
  document.getElementById('main-app').style.display   = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  allTrades=[]; userSteps=[]; userModels=[];
}

function setAuthMsg(el, text, type) { el.textContent=text; el.className=`auth-msg ${type}`; }

// ── BOOT ──────────────────────────────────────────────────────
async function bootApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('main-app').style.display    = 'flex';
  const email = getUserEmail();
  const displayName = getUserDisplayName();
  document.getElementById('user-email').textContent     = displayName || email;
  document.getElementById('settings-email').textContent = email;
  initDarkMode();
  const optIn = localStorage.getItem('nxuu_lb_optin') === 'true';
  const toggle = document.getElementById('lb-opt-in');
  if (toggle) toggle.checked = optIn;
  await Promise.all([loadTrades(), loadSteps(), loadModels()]);
}

// ── TABS ──────────────────────────────────────────────────────
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b=>{
    b.classList.toggle('active',b.dataset.tab===tabName);
    b.setAttribute('aria-selected',b.dataset.tab===tabName);
  });
  document.querySelectorAll('.tab-pane').forEach(p=>{
    p.classList.toggle('active',p.id===`tab-${tabName}`);
  });
  if (tabName==='calendar')    renderCalendar();
  if (tabName==='equity')      renderEquity();
  if (tabName==='stats')       renderStats();
  if (tabName==='settings')    renderSettings();
  if (tabName==='leaderboard') renderLeaderboard();
}

// ── CHECKLIST ─────────────────────────────────────────────────
async function loadSteps() { try { userSteps=await fetchSteps(); } catch(e){ userSteps=[]; } renderChecklist(); }

function renderChecklist() {
  const wrap  = document.getElementById('checklist-steps-wrap');
  const total = userSteps.length;
  const prog = document.getElementById('prog-big');
  if (prog) prog.textContent = `0 / ${total}`;
  
  if (total===0) { 
    wrap.textContent='No checklist steps yet. Add them in Settings.';
    wrap.className = 'empty-state';
    return;
  }
  
  const sections={};
  userSteps.forEach(s=>{ if(!sections[s.section])sections[s.section]=[]; sections[s.section].push(s); });
  const colors=['olive','blue','amber','purple','rose','teal','slate','brown'];
  wrap.innerHTML='';
  
  let sIdx=0;
  Object.entries(sections).forEach(([name,steps])=>{
    const color=colors[sIdx%colors.length]; sIdx++;
    
    const section = document.createElement('section');
    section.className = `section`;
    section.setAttribute('data-color', color);
    
    // Section header
    const header = document.createElement('div');
    header.className = 'sec-label';
    header.innerHTML = `<div class="sec-icon">${String(sIdx).padStart(2,'0')}</div><h2 class="sec-name">${escapeHtml(name)}</h2><div class="sec-rule"></div>`;
    section.appendChild(header);
    
    // Steps list
    const ul = document.createElement('ul');
    ul.className = 'steps-wrap';
    
    steps.forEach((step, idx) => {
      const li = document.createElement('li');
      li.className = 'step';
      li.setAttribute('data-id', step.id);
      li.setAttribute('tabindex', '0');
      li.onclick = function() { tog(this); };
      li.onkeydown = function(e) { if(e.key==='Enter'||e.key===' '){e.preventDefault();tog(this);} };
      
      const numStr = String(userSteps.indexOf(step)+1).padStart(2,'0');
      li.innerHTML = `<div class="step-left-bar"></div><span class="step-num">${numStr}</span><div class="step-body"><span class="step-cat">${escapeHtml(name)}</span><p class="step-title">${escapeHtml(step.title)}</p></div><div class="step-cb"><svg class="cb-svg" width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.8 7L9 1" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
      
      ul.appendChild(li);
    });
    
    section.appendChild(ul);
    wrap.appendChild(section);
  });
  
  updateChecklistProgress();
}

// Helper to safely escape HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function tog(el) { unlockAudio(); el.classList.toggle('checked'); const c=el.classList.contains('checked'); el.setAttribute('aria-checked',c); el.classList.remove('bounce'); void el.offsetWidth; el.classList.add('bounce'); c?playTick():playUncheck(); updateChecklistProgress(); }
function handleKey(e,el) { if(e.key==='Enter'||e.key===' '){e.preventDefault();tog(el);} }
function updateChecklistProgress() {
  const total=userSteps.length, done=document.querySelectorAll('.step.checked').length;
  const prog = document.getElementById('prog-big');
  if (prog) prog.textContent = `${done} / ${total}`;
  const fill = document.getElementById('fill');
  if (fill) fill.style.width=total>0?`${Math.round(done/total*100)}%`:'0%';
  const banner=document.getElementById('complete-banner');
  if(total>0&&done===total){banner.classList.add('visible');fireConfetti();playFanfare();}
  else banner.classList.remove('visible');
}
function resetChecklist() { document.querySelectorAll('.step').forEach(s=>{s.classList.remove('checked','bounce');s.setAttribute('aria-checked','false');}); updateChecklistProgress(); }

// ── MODELS ────────────────────────────────────────────────────
async function loadModels() { try { userModels=await fetchModels(); } catch(e){ userModels=[]; } populateModelDropdown(); }
function populateModelDropdown() {
  const opts = `<option value="">Select...</option>`+userModels.map(m=>`<option value="${escapeHtml(m.name)}">${escapeHtml(m.name)}</option>`).join('');
  const sel = document.getElementById('f-model');
  if (sel) sel.innerHTML = opts;
  const filSel = document.getElementById('fil-model');
  if (filSel) filSel.innerHTML = `<option value="">All Models</option>`+userModels.map(m=>`<option value="${escapeHtml(m.name)}">${escapeHtml(m.name)}</option>`).join('');
}

// ── TRADE LOG ─────────────────────────────────────────────────
function initForm() {
  document.getElementById('f-date').value = new Date().toISOString().split('T')[0];
  document.querySelectorAll('.result-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{ document.querySelectorAll('.result-btn').forEach(b=>b.classList.remove('selected')); btn.classList.add('selected'); selectedResult=btn.dataset.value; });
  });
}

async function submitTrade() {
  const date=document.getElementById('f-date').value, session=document.getElementById('f-session').value;
  const model=document.getElementById('f-model').value, rRaw=document.getElementById('f-r').value;
  const pnlRaw=document.getElementById('f-pnl').value, notes=document.getElementById('f-notes').value.trim();
  const account=document.getElementById('f-account').value.trim();
  const btn=document.getElementById('submitBtn'), btnText=document.getElementById('submit-text');
  
  // Validation
  let error = Validators.date(date);
  if (error) return showFormMsg(error, 'error');
  if (!selectedResult) return showFormMsg('Please select Win, Loss, or BE.','error');
  if (rRaw===''&&pnlRaw==='') return showFormMsg('Please enter at least an R value or PnL.','error');
  
  error = Validators.currency(rRaw);
  if (error) return showFormMsg(error, 'error');
  
  error = Validators.currency(pnlRaw);
  if (error) return showFormMsg(error, 'error');
  
  error = Validators.tradeNotes(notes);
  if (error) return showFormMsg(error, 'error');
  
  error = Validators.accountName(account);
  if (error) return showFormMsg(error, 'error');
  
  btn.disabled=true; btnText.textContent='Saving...';
  try {
    await insertTrade({ date, result:selectedResult, r_value:rRaw!==''?parseFloat(rRaw):0, pnl_usd:pnlRaw!==''?parseFloat(pnlRaw):0, notes:notes||null, model:model||null, session:session||null, account:account||null });
    showFormMsg('Trade saved!','success'); resetForm(); await loadTrades();
  } catch(e) { showFormMsg('Failed to save. Check your connection.','error'); console.error(e); }
  finally { btn.disabled=false; btnText.textContent='Save Trade'; }
}

function resetForm() {
  document.getElementById('f-date').value=new Date().toISOString().split('T')[0];
  ['f-session','f-model','f-r','f-pnl','f-notes','f-account'].forEach(id=>{ const el=document.getElementById(id); if(el)el.value=''; });
  document.querySelectorAll('.result-btn').forEach(b=>b.classList.remove('selected')); selectedResult=null;
}

function showFormMsg(text,type) { const el=document.getElementById('form-msg'); el.textContent=text; el.className=`form-msg ${type}`; setTimeout(()=>{el.textContent='';el.className='form-msg';},4000); }

async function loadTrades() {
  try {
    allTrades = await fetchAllTrades();
    rebuildAccountSwitcher();
    applyFilters();
  } catch(e) {
    const list = document.getElementById('trade-list');
    if (list) list.textContent='Could not load trades.';
    console.error(e);
  }
}

function getAccountTrades() {
  if (!activeAccount) return allTrades;
  return allTrades.filter(t => (t.account || '') === activeAccount);
}

function rebuildAccountSwitcher() {
  const sel = document.getElementById('account-switcher');
  if (!sel) return;
  const accounts = [...new Set(allTrades.map(t => t.account).filter(Boolean))].sort();
  const prev = sel.value;
  sel.innerHTML = `<option value="">All Accounts</option>` +
    accounts.map(a => `<option value="${escapeHtml(a)}"${a===prev?' selected':''}>${escapeHtml(a)}</option>`).join('');
  if (prev && !accounts.includes(prev)) {
    activeAccount = '';
    sel.value = '';
  }
  const wrap = document.getElementById('account-switcher-wrap');
  if (wrap) wrap.style.display = accounts.length > 0 ? 'flex' : 'none';
}

function switchAccount() {
  const sel = document.getElementById('account-switcher');
  activeAccount = sel ? sel.value : '';
  applyFilters();
  const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
  if (activeTab === 'equity')   renderEquity();
  if (activeTab === 'stats')    renderStats();
  if (activeTab === 'calendar') renderCalendar();
}

// ── FILTERS ───────────────────────────────────────────────────
function applyFilters() {
  activeFilters.result  = document.getElementById('fil-result').value;
  activeFilters.session = document.getElementById('fil-session').value;
  activeFilters.model   = document.getElementById('fil-model').value;
  activeFilters.account = document.getElementById('fil-account').value;
  activeFilters.from    = document.getElementById('fil-from').value;
  activeFilters.to      = document.getElementById('fil-to').value;

  let filtered = getAccountTrades();
  if (activeFilters.result)  filtered = filtered.filter(t=>t.result===activeFilters.result);
  if (activeFilters.session) filtered = filtered.filter(t=>t.session===activeFilters.session);
  if (activeFilters.model)   filtered = filtered.filter(t=>t.model===activeFilters.model);
  if (activeFilters.account) filtered = filtered.filter(t=>(t.account||'').toLowerCase()===activeFilters.account.toLowerCase());
  if (activeFilters.from)    filtered = filtered.filter(t=>t.date>=activeFilters.from);
  if (activeFilters.to)      filtered = filtered.filter(t=>t.date<=activeFilters.to);

  const hasFilters = Object.values(activeFilters).some(v=>v!=='');
  const countEl = document.getElementById('filter-count');
  if (hasFilters && countEl) countEl.textContent = `${filtered.length} of ${getAccountTrades().length}`;
  else if (countEl) countEl.textContent = '';

  renderTradeList(filtered);
}

function clearFilters() {
  ['fil-result','fil-session','fil-model','fil-account','fil-from','fil-to'].forEach(id=>{ const el=document.getElementById(id); if(el)el.value=''; });
  activeFilters = { result:'', session:'', model:'', account:'', from:'', to:'' };
  const countEl = document.getElementById('filter-count');
  if (countEl) countEl.textContent = '';
  renderTradeList(getAccountTrades());
}

// ── TRADE LIST ────────────────────────────────────────────────
function renderTradeList(trades) {
  const listEl = document.getElementById('trade-list');
  if (!trades || trades.length===0) {
    listEl.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = getAccountTrades().length===0
      ? 'No trades yet. Log your first trade above.'
      : 'No trades match your filters.';
    listEl.appendChild(empty);
    return;
  }
  
  listEl.innerHTML = '';
  trades.slice(0,100).forEach(t => {
    const rDisplay   = t.r_value  ? (t.r_value>0?`+${t.r_value}R`:`${t.r_value}R`) : '';
    const pnlDisplay = t.pnl_usd  ? (t.pnl_usd>0?`+$${t.pnl_usd.toFixed(2)}`:`-$${Math.abs(t.pnl_usd).toFixed(2)}`) : '';
    const dateStr    = new Date(t.date+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
    
    const row = document.createElement('div');
    row.className = 'trade-row';
    row.onclick = () => openTradeDetail(t.id);
    
    const rowLeft = document.createElement('div');
    rowLeft.className = 'trade-row-left';
    
    const top = document.createElement('div');
    top.className = 'trade-row-top';
    
    const resultBadge = document.createElement('span');
    resultBadge.className = `trade-result ${t.result}`;
    resultBadge.textContent = t.result.toUpperCase();
    top.appendChild(resultBadge);
    
    const dateEl = document.createElement('span');
    dateEl.className = 'trade-date';
    dateEl.textContent = dateStr;
    top.appendChild(dateEl);
    
    if (t.account) {
      const accountTag = document.createElement('span');
      accountTag.className = 'trade-tag account-tag';
      accountTag.textContent = t.account;
      top.appendChild(accountTag);
    }
    
    if (t.model) {
      const modelTag = document.createElement('span');
      modelTag.className = 'trade-tag';
      modelTag.textContent = t.model;
      top.appendChild(modelTag);
    }
    
    if (t.session) {
      const sessionTag = document.createElement('span');
      sessionTag.className = 'trade-tag';
      sessionTag.textContent = t.session;
      top.appendChild(sessionTag);
    }
    
    rowLeft.appendChild(top);
    
    if (t.notes) {
      const notesEl = document.createElement('p');
      notesEl.className = 'trade-notes';
      notesEl.textContent = t.notes;
      rowLeft.appendChild(notesEl);
    }
    
    row.appendChild(rowLeft);
    
    const rowRight = document.createElement('div');
    rowRight.className = 'trade-row-right';
    
    const values = document.createElement('div');
    values.className = 'trade-values';
    
    if (rDisplay) {
      const rEl = document.createElement('span');
      rEl.className = `trade-r ${t.result}`;
      rEl.textContent = rDisplay;
      values.appendChild(rEl);
    }
    
    if (pnlDisplay) {
      const pnlEl = document.createElement('span');
      pnlEl.className = `trade-pnl ${t.pnl_usd>=0?'win':'loss'}`;
      pnlEl.textContent = pnlDisplay;
      values.appendChild(pnlEl);
    }
    
    rowRight.appendChild(values);
    
    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.type = 'button';
    delBtn.textContent = '✕';
    delBtn.onclick = (e) => { e.stopPropagation(); confirmDelete(t.id); };
    rowRight.appendChild(delBtn);
    
    row.appendChild(rowRight);
    listEl.appendChild(row);
  });
}

async function confirmDelete(id) {
  if (!confirm('Delete this trade?')) return;
  try { await deleteTrade(id); closeTradeModal(); await loadTrades(); }
  catch(e) { alert('Could not delete trade.'); }
}

// ── TRADE DETAIL MODAL ────────────────────────────────────────
function openTradeDetail(id) {
  const t = allTrades.find(x=>x.id===id);
  if (!t) return;
  
  const dateStr = new Date(t.date+'T00:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const rDisplay   = t.r_value  ? (t.r_value>0?`+${t.r_value}R`:`${t.r_value}R`) : '—';
  const pnlDisplay = t.pnl_usd  ? (t.pnl_usd>0?`+$${t.pnl_usd.toFixed(2)}`:`-$${Math.abs(t.pnl_usd).toFixed(2)}`) : '—';
  const pnlClass   = t.pnl_usd >= 0 ? 'win-col' : 'loss-col';

  const modalBody = document.getElementById('modal-body');
  modalBody.innerHTML = '';
  
  // Badges row
  const badgeRow = document.createElement('div');
  badgeRow.className = 'detail-badge-row';
  
  const resultBadge = document.createElement('span');
  resultBadge.className = `detail-badge ${t.result}`;
  resultBadge.textContent = t.result.toUpperCase();
  badgeRow.appendChild(resultBadge);
  
  if (t.account) {
    const accountBadge = document.createElement('span');
    accountBadge.className = 'detail-badge account';
    accountBadge.textContent = t.account;
    badgeRow.appendChild(accountBadge);
  }
  
  if (t.model) {
    const modelBadge = document.createElement('span');
    modelBadge.className = 'detail-badge tag';
    modelBadge.textContent = t.model;
    badgeRow.appendChild(modelBadge);
  }
  
  if (t.session) {
    const sessionBadge = document.createElement('span');
    sessionBadge.className = 'detail-badge tag';
    sessionBadge.textContent = t.session;
    badgeRow.appendChild(sessionBadge);
  }
  
  modalBody.appendChild(badgeRow);
  
  // Date
  const dateEl = document.createElement('div');
  dateEl.style.cssText = 'font-family:var(--font-mono);font-size:10px;color:var(--text4);letter-spacing:0.08em;';
  dateEl.textContent = dateStr;
  modalBody.appendChild(dateEl);
  
  // Grid
  const grid = document.createElement('div');
  grid.className = 'detail-grid';
  
  const rItem = document.createElement('div');
  rItem.className = 'detail-item';
  const rLabel = document.createElement('div');
  rLabel.className = 'detail-item-label';
  rLabel.textContent = 'R Value';
  const rVal = document.createElement('div');
  rVal.className = `detail-item-val ${t.r_value>0?'win-col':t.r_value<0?'loss-col':''}`;
  rVal.textContent = rDisplay;
  rItem.appendChild(rLabel);
  rItem.appendChild(rVal);
  grid.appendChild(rItem);
  
  const pnlItem = document.createElement('div');
  pnlItem.className = 'detail-item';
  const pnlLabel = document.createElement('div');
  pnlLabel.className = 'detail-item-label';
  pnlLabel.textContent = 'PnL (USD)';
  const pnlVal = document.createElement('div');
  pnlVal.className = `detail-item-val ${pnlClass}`;
  pnlVal.textContent = pnlDisplay;
  pnlItem.appendChild(pnlLabel);
  pnlItem.appendChild(pnlVal);
  grid.appendChild(pnlItem);
  
  modalBody.appendChild(grid);
  
  // Notes
  if (t.notes) {
    const notesBox = document.createElement('div');
    notesBox.className = 'detail-notes-box';
    const notesLabel = document.createElement('div');
    notesLabel.className = 'detail-notes-label';
    notesLabel.textContent = 'Notes';
    const notesText = document.createElement('div');
    notesText.className = 'detail-notes-text';
    notesText.textContent = t.notes;
    notesBox.appendChild(notesLabel);
    notesBox.appendChild(notesText);
    modalBody.appendChild(notesBox);
  }
  
  document.getElementById('modal-delete-btn').onclick = () => confirmDelete(t.id);
  const overlay = document.getElementById('trade-modal');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeTradeModal(e) {
  if (e && e.target !== document.getElementById('trade-modal')) return;
  document.getElementById('trade-modal').classList.remove('open');
  document.body.style.overflow = '';
}

// ── CALENDAR ──────────────────────────────────────────────────
async function renderCalendar() {
  const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthLabel = document.getElementById('cal-month-label');
  if (monthLabel) monthLabel.textContent=`${MONTHS[calMonth-1]} ${calYear}`;
  
  const grid=document.getElementById('cal-grid');
  if (grid) grid.innerHTML='<div class="cal-loading">Loading...</div>';
  
  let trades=[];
  try { trades=await fetchTradesByMonth(calYear,calMonth); } catch(e){ console.error(e); }
  
  if (activeAccount) trades = trades.filter(t=>(t.account||'')===activeAccount);
  
  const tradeMap={};
  trades.forEach(t=>{ if(!tradeMap[t.date])tradeMap[t.date]=[]; tradeMap[t.date].push(t); });
  const totalPnl=trades.reduce((s,t)=>s+(t.pnl_usd||0),0);
  const wins=trades.filter(t=>t.result==='win').length, wr=trades.length>0?Math.round(wins/trades.length*100):0;
  
  const pnlEl=document.getElementById('cal-pnl');
  if (pnlEl) {
    pnlEl.textContent=trades.length>0?(totalPnl>=0?`+$${totalPnl.toFixed(0)}`:`-$${Math.abs(totalPnl).toFixed(0)}`):' — ';
    pnlEl.className=`cal-stat-val ${totalPnl>=0?'win-col':'loss-col'}`;
  }
  const tradesEl=document.getElementById('cal-trades');
  if (tradesEl) tradesEl.textContent=trades.length||' — ';
  const wrEl=document.getElementById('cal-wr');
  if (wrEl) wrEl.textContent=trades.length>0?`${wr}%`:' — ';
  
  const firstDay=new Date(calYear,calMonth-1,1).getDay(), daysInMonth=new Date(calYear,calMonth,0).getDate(), today=new Date().toISOString().split('T')[0];
  const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  
  if (grid) {
    grid.innerHTML='';
    DAYS.forEach(d=>{const el=document.createElement('div');el.className='cal-day-hd';el.textContent=d;grid.appendChild(el);});
    
    for(let i=0;i<firstDay;i++){const el=document.createElement('div');el.className='cal-cell empty';grid.appendChild(el);}
    
    for(let d=1;d<=daysInMonth;d++){
      const ds=`${calYear}-${String(calMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`, dts=tradeMap[ds]||[];
      const isToday=ds===today, dayPnl=dts.reduce((s,t)=>s+(t.pnl_usd||0),0), count=dts.length;
      
      let cls='cal-cell'; 
      if(isToday)cls+=' today';
      if(count>0){
        const hasWin=dts.some(t=>t.result==='win'),hasLoss=dts.some(t=>t.result==='loss'),allBE=dts.every(t=>t.result==='be');
        if(allBE)cls+=' be'; else if(hasWin&&!hasLoss)cls+=' win'; else if(hasLoss&&!hasWin)cls+=' loss'; else cls+=' mixed';
      }
      
      const cell=document.createElement('div');
      cell.className=cls;
      const dayNum=document.createElement('span');
      dayNum.className='cal-day-num';
      dayNum.textContent=d;
      cell.appendChild(dayNum);
      
      if(count>0){
        const pnlLabel=document.createElement('span');
        pnlLabel.className=`cal-pnl-val ${dayPnl>=0?'pos':'neg'}`;
        pnlLabel.textContent=`${dayPnl>=0?'+':''}$${Math.abs(dayPnl).toFixed(0)}`;
        cell.appendChild(pnlLabel);
        
        const cntLabel=document.createElement('span');
        cntLabel.className='cal-count';
        cntLabel.textContent=`${count}t`;
        cell.appendChild(cntLabel);
      }
      
      grid.appendChild(cell);
    }
  }
}

// ── EQUITY CURVE ──────────────────────────────────────────────
function renderEquity() {
  const emptyEl=document.getElementById('equity-empty'), canvas=document.getElementById('equity-chart');
  const trades = getAccountTrades();
  if(trades.length===0){ 
    if (emptyEl) emptyEl.style.display='flex'; 
    if (canvas) canvas.style.display='none'; 
    ['eq-total','eq-best','eq-worst','eq-dd'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=' — ';});
    return;
  }
  if (emptyEl) emptyEl.style.display='none'; 
  if (canvas) canvas.style.display='block';
  
  const sorted=[...trades].sort((a,b)=>new Date(a.date)-new Date(b.date));
  const labels=[],data=[]; let cum=0;
  sorted.forEach(t=>{ cum+=t.pnl_usd||0; labels.push(new Date(t.date+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'})); data.push(parseFloat(cum.toFixed(2))); });
  const pnlVals=sorted.map(t=>t.pnl_usd||0), total=cum, best=Math.max(...pnlVals), worst=Math.min(...pnlVals);
  let peak=0,maxDD=0; data.forEach(v=>{ if(v>peak)peak=v; const dd=peak-v; if(dd>maxDD)maxDD=dd; });
  
  const fmt=v=>v>=0?`+$${v.toFixed(2)}`:`-$${Math.abs(v).toFixed(2)}`;
  const totalEl = document.getElementById('eq-total');
  if (totalEl) { totalEl.textContent=fmt(total); totalEl.className=`equity-stat-val ${total>=0?'win-col':'loss-col'}`; }
  const bestEl = document.getElementById('eq-best');
  if (bestEl) bestEl.textContent=fmt(best);
  const worstEl = document.getElementById('eq-worst');
  if (worstEl) worstEl.textContent=fmt(worst);
  const ddEl = document.getElementById('eq-dd');
  if (ddEl) ddEl.textContent=`-$${maxDD.toFixed(2)}`;
  
  if(equityChart)equityChart.destroy();
  const isDark=document.documentElement.getAttribute('data-theme')==='dark';
  const col=total>=0?(isDark?'#4ade80':'#6b7a52'):(isDark?'#f87171':'#8a4a4a');
  const fillCol=total>=0?(isDark?'rgba(74,222,128,0.08)':'rgba(107,122,82,0.08)'):(isDark?'rgba(248,113,113,0.08)':'rgba(138,74,74,0.08)');
  const tickColor=isDark?'#444444':'#8a8478', gridColor=isDark?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.04)';
  
  if (canvas) {
    equityChart=new Chart(canvas,{ type:'line', data:{ labels, datasets:[{ data, borderColor:col, borderWidth:2, pointRadius:3, pointBackgroundColor:col, fill:true, backgroundColor:fillCol, tension:0.3 }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:{callbacks:{label:ctx=>fmt(ctx.raw)}} }, scales:{ x:{ticks:{color:tickColor,font:{size:10,family:'DM Mono'},maxTicksLimit:8,maxRotation:0},grid:{color:gridColor}}, y:{ticks:{color:tickColor,font:{size:10,family:'DM Mono'},callback:v=>v>=0?`+$${v}`:`-$${Math.abs(v)}`},grid:{color:gridColor}} } } });
  }
}

// ── STATS / DASHBOARD ─────────────────────────────────────────
let statsChartMode = 'usd';
let statsChart = null;

function calcStreaks(trades) {
  const sorted = [...trades].sort((a,b)=>new Date(a.date)-new Date(b.date));
  let bestStreak=0, worstStreak=0, curWin=0, curLoss=0;
  sorted.forEach(t=>{
    if(t.result==='win')  { curWin++; curLoss=0; bestStreak=Math.max(bestStreak,curWin); }
    else if(t.result==='loss') { curLoss++; curWin=0; worstStreak=Math.max(worstStreak,curLoss); }
    else { curWin=0; curLoss=0; }
  });
  return { bestStreak, worstStreak };
}

function renderStats() {
  const trades = getAccountTrades();
  const emptyIds = ['st-total','st-wr','st-avgr','st-totalpnl','st-pf','st-avgwin','st-avgloss','st-rr','st-exp','st-beststreak','st-worststreak'];
  if(trades.length===0){
    emptyIds.forEach(id=>{ const el=document.getElementById(id); if(el)el.textContent='—'; });
    const sub1=document.getElementById('st-tradecnt'); if(sub1)sub1.textContent='— trades';
    const sub2=document.getElementById('st-wl-sub');  if(sub2)sub2.textContent='— W · — L';
    const sub3=document.getElementById('st-pf');      if(sub3)sub3.textContent='—';
    ['model-stats','session-stats','account-stats'].forEach(id=>{const el=document.getElementById(id);if(el){el.innerHTML='';const empty=document.createElement('div');empty.className='empty-state';empty.textContent='No trades yet.';el.appendChild(empty);}});
    renderStatsChart([]);
    return;
  }

  const wins   = trades.filter(t=>t.result==='win');
  const losses = trades.filter(t=>t.result==='loss');
  const total  = trades.length;
  const totalPnl = trades.reduce((s,t)=>s+(t.pnl_usd||0),0);
  const totalR   = trades.reduce((s,t)=>s+(t.r_value||0),0);
  const wr    = Math.round(wins.length/total*100);
  const avgR  = totalR/total;

  const grossWin  = wins.reduce((s,t)=>s+(t.pnl_usd||0),0);
  const grossLoss = Math.abs(losses.reduce((s,t)=>s+(t.pnl_usd||0),0));
  const pf = grossLoss>0 ? (grossWin/grossLoss).toFixed(2) : grossWin>0 ? '∞' : '—';

  const avgWin  = wins.length>0   ? grossWin/wins.length   : 0;
  const avgLoss = losses.length>0 ? grossLoss/losses.length : 0;

  const avgWinR  = wins.length>0   ? wins.reduce((s,t)=>s+(t.r_value||0),0)/wins.length   : 0;
  const avgLossR = losses.length>0 ? Math.abs(losses.reduce((s,t)=>s+(t.r_value||0),0)/losses.length) : 0;
  const rrRatio  = avgLossR>0 ? (avgWinR/avgLossR).toFixed(2) : avgWinR>0 ? '∞' : '—';

  const lr = losses.length/total;
  const expectancy = (wr/100)*avgWin - lr*avgLoss;

  const { bestStreak, worstStreak } = calcStreaks(trades);

  const pnlEl = document.getElementById('st-totalpnl');
  if (pnlEl) { pnlEl.textContent = totalPnl>=0?`+$${totalPnl.toFixed(2)}`:`-$${Math.abs(totalPnl).toFixed(2)}`; pnlEl.className = `dash-hero-val ${totalPnl>=0?'win-col':'loss-col'}`; }
  
  const tradeCntEl = document.getElementById('st-tradecnt');
  if (tradeCntEl) tradeCntEl.textContent = `${total} trade${total!==1?'s':''}`;

  const wrEl = document.getElementById('st-wr');
  if (wrEl) { wrEl.textContent = `${wr}%`; wrEl.className = `dash-hero-val ${wr>=50?'win-col':'loss-col'}`; }
  
  const wlEl = document.getElementById('st-wl-sub');
  if (wlEl) wlEl.textContent = `${wins.length}W · ${losses.length}L`;

  const pfEl = document.getElementById('st-pf');
  if (pfEl) { pfEl.textContent = pf; pfEl.className = `dash-hero-val ${parseFloat(pf)>=1?'win-col':'loss-col'}`; }

  const setMetric = (id, val, cls='') => {
    const el = document.getElementById(id); if(!el)return;
    el.textContent = val;
    if(cls) el.className = `dash-metric-val ${cls}`;
  };
  
  setMetric('st-avgwin',  avgWin>0?`+$${avgWin.toFixed(2)}`:'—',  'win-col');
  setMetric('st-avgloss', avgLoss>0?`-$${avgLoss.toFixed(2)}`:'—', 'loss-col');
  setMetric('st-rr',      rrRatio);
  setMetric('st-exp',     isNaN(expectancy)?'—':`${expectancy>=0?'+':''}$${Math.abs(expectancy).toFixed(2)}`);
  setMetric('st-beststreak',  bestStreak>0?`${bestStreak}W`:'—',  bestStreak>0?'win-col':'');
  setMetric('st-worststreak', worstStreak>0?`${worstStreak}L`:'—', worstStreak>0?'loss-col':'');
  setMetric('st-avgr', `${avgR>=0?'+':''}${avgR.toFixed(2)}R`);
  
  const totalEl = document.getElementById('st-total');
  if (totalEl) totalEl.textContent = total;

  renderStatsChart(trades);

  // Performance rows
  const buildPerfRows=(groupKey,elId)=>{
    const groups={};
    trades.forEach(t=>{ const k=t[groupKey]?(t[groupKey].charAt(0).toUpperCase()+t[groupKey].slice(1)):'Other'; if(!groups[k])groups[k]={wins:0,losses:0,be:0,pnl:0,r:0}; groups[k][t.result==='win'?'wins':t.result==='loss'?'losses':'be']++; groups[k].pnl+=t.pnl_usd||0; groups[k].r+=t.r_value||0; });
    const el = document.getElementById(elId);
    if (el) {
      el.innerHTML='';
      Object.entries(groups).forEach(([name,d])=>{ 
        const t=d.wins+d.losses+d.be,w=t>0?Math.round(d.wins/t*100):0,pnlStr=d.pnl>=0?`+$${d.pnl.toFixed(2)}`:`-$${Math.abs(d.pnl).toFixed(2)}`;
        const row = document.createElement('div');
        row.className = 'perf-row';
        
        const nameEl = document.createElement('div');
        nameEl.className = 'perf-name';
        nameEl.textContent = name;
        row.appendChild(nameEl);
        
        const metaEl = document.createElement('div');
        metaEl.className = 'perf-meta';
        metaEl.innerHTML = `<span class="perf-wr">${w}% WR</span><span class="perf-r ${d.pnl>=0?'win-col':'loss-col'}">${pnlStr}</span><span class="perf-count">${t} trades</span>`;
        row.appendChild(metaEl);
        
        el.appendChild(row);
      });
    }
  };
  buildPerfRows('model','model-stats'); buildPerfRows('session','session-stats'); buildPerfRows('account','account-stats');
}

function renderStatsChart(trades) {
  const canvas  = document.getElementById('stats-cumulative-chart');
  const emptyEl = document.getElementById('stats-chart-empty');
  if (!canvas) return;

  if (!trades || trades.length===0) {
    canvas.style.display='none'; 
    if (emptyEl) emptyEl.style.display='flex'; 
    return;
  }
  canvas.style.display='block'; 
  if (emptyEl) emptyEl.style.display='none';

  const sorted = [...trades].sort((a,b)=>new Date(a.date)-new Date(b.date));
  const labels=[], dataUsd=[], dataR=[];
  let cumUsd=0, cumR=0;
  sorted.forEach(t=>{
    cumUsd += t.pnl_usd||0;
    cumR   += t.r_value||0;
    labels.push(new Date(t.date+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'}));
    dataUsd.push(parseFloat(cumUsd.toFixed(2)));
    dataR.push(parseFloat(cumR.toFixed(2)));
  });

  const values = statsChartMode==='usd' ? dataUsd : dataR;
  const total  = values[values.length-1] || 0;
  const isDark = document.documentElement.getAttribute('data-theme')==='dark';
  const accentColor = isDark ? '#4ade80' : '#5a6e42';
  const fillColor   = isDark ? 'rgba(74,222,128,0.08)' : 'rgba(90,110,66,0.08)';
  const tickColor   = isDark ? '#4a4a4a' : '#8a8478';
  const gridColor   = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
  const labelFmt    = statsChartMode==='usd'
    ? v=>(v>=0?`+$${v.toFixed(0)}`:`-$${Math.abs(v).toFixed(0)}`)
    : v=>(v>=0?`+${v.toFixed(2)}R`:`${v.toFixed(2)}R`);

  if(statsChart) statsChart.destroy();
  statsChart = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets:[{
      data: values,
      borderColor: accentColor,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: accentColor,
      fill: true,
      backgroundColor: fillColor,
      tension: 0.3
    }]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label:ctx=>labelFmt(ctx.raw)}} },
      scales:{
        x:{ticks:{color:tickColor,font:{size:9,family:'DM Mono'},maxTicksLimit:8,maxRotation:0},grid:{color:gridColor}},
        y:{ticks:{color:tickColor,font:{size:9,family:'DM Mono'},callback:labelFmt},grid:{color:gridColor}}
      }
    }
  });
}

function switchStatsChart(mode) {
  statsChartMode = mode;
  const usdBtn = document.getElementById('stats-toggle-usd');
  const rBtn = document.getElementById('stats-toggle-r');
  if (usdBtn) usdBtn.classList.toggle('active', mode==='usd');
  if (rBtn) rBtn.classList.toggle('active', mode==='r');
  renderStatsChart(getAccountTrades());
}

// ── STARTING BALANCE ──────────────────────────────────────────
function saveStartingBalance() {
  const input = document.getElementById('starting-balance-input');
  const msg   = document.getElementById('starting-balance-msg');
  const val   = parseFloat(input.value);
  
  const error = Validators.startingBalance(input.value);
  if (error) {
    msg.textContent = error; msg.className='auth-msg error';
    setTimeout(()=>{msg.textContent='';msg.className='auth-msg';},3000); 
    return;
  }
  
  localStorage.setItem('nxuu_starting_balance', val.toString());
  msg.textContent='Saved!'; msg.className='auth-msg success';
  setTimeout(()=>{msg.textContent='';msg.className='auth-msg';},3000);
}

// ── LEADERBOARD ───────────────────────────────────────────────
async function renderLeaderboard() {
  const lbWr = document.getElementById('lb-winrate');
  const lbPnl = document.getElementById('lb-pnl');
  if (lbWr) lbWr.innerHTML = `<div class="lb-empty">Loading...</div>`;
  if (lbPnl) lbPnl.innerHTML = `<div class="lb-empty">Loading...</div>`;
  
  try {
    const rows = await fetchLeaderboard();
    const myId = getUserId();

    if (!rows || rows.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'lb-empty';
      empty.textContent = 'No team members on the leaderboard yet. Enable sharing in Settings.';
      
      if (lbWr) { lbWr.innerHTML = ''; lbWr.appendChild(empty.cloneNode(true)); }
      if (lbPnl) { lbPnl.innerHTML = ''; lbPnl.appendChild(empty.cloneNode(true)); }
      return;
    }

    // Win-rate leaderboard
    const byWR = [...rows].sort((a,b)=>b.win_rate-a.win_rate);
    const maxWR = byWR[0]?.win_rate || 1;
    
    if (lbWr) {
      lbWr.innerHTML = '';
      byWR.forEach((r, i) => {
        const rankClass = i===0?'gold':i===1?'silver':i===2?'bronze':'';
        const isMe = r.user_id === myId;
        const pct = Math.round((r.win_rate/maxWR)*100);
        
        const row = document.createElement('div');
        row.className = 'lb-row';
        
        const rank = document.createElement('span');
        rank.className = `lb-rank ${rankClass}`;
        rank.textContent = i+1;
        row.appendChild(rank);
        
        const barWrap = document.createElement('div');
        barWrap.className = 'lb-bar-wrap';
        const bar = document.createElement('div');
        bar.className = 'lb-bar';
        bar.style.width = pct + '%';
        barWrap.appendChild(bar);
        row.appendChild(barWrap);
        
        const name = document.createElement('span');
        name.className = 'lb-name';
        const displayName = r.display_name || r.email?.split('@')[0] || 'Trader';
        name.textContent = displayName + (isMe ? ' ' : '');
        if (isMe) {
          const badge = document.createElement('span');
          badge.className = 'lb-you-badge';
          badge.textContent = 'you';
          name.appendChild(badge);
        }
        row.appendChild(name);
        
        const meta = document.createElement('div');
        meta.className = 'lb-meta';
        meta.innerHTML = `<span class="lb-wr">${Math.round(r.win_rate)}%</span><span class="lb-pnl">${r.total_trades} trades</span>`;
        row.appendChild(meta);
        
        lbWr.appendChild(row);
      });
    }

    // PnL leaderboard
    const byPnl = [...rows].sort((a,b)=>b.total_pnl-a.total_pnl);
    const maxPnl = Math.max(...byPnl.map(r=>Math.abs(r.total_pnl)), 1);
    
    if (lbPnl) {
      lbPnl.innerHTML = '';
      byPnl.forEach((r, i) => {
        const rankClass = i===0?'gold':i===1?'silver':i===2?'bronze':'';
        const isMe = r.user_id === myId;
        const pct = Math.round((Math.abs(r.total_pnl)/maxPnl)*100);
        const pnlStr = r.total_pnl>=0 ? `+$${r.total_pnl.toFixed(0)}` : `-$${Math.abs(r.total_pnl).toFixed(0)}`;
        
        const row = document.createElement('div');
        row.className = 'lb-row';
        
        const rank = document.createElement('span');
        rank.className = `lb-rank ${rankClass}`;
        rank.textContent = i+1;
        row.appendChild(rank);
        
        const barWrap = document.createElement('div');
        barWrap.className = 'lb-bar-wrap';
        const bar = document.createElement('div');
        bar.className = 'lb-bar';
        bar.style.width = pct + '%';
        barWrap.appendChild(bar);
        row.appendChild(barWrap);
        
        const name = document.createElement('span');
        name.className = 'lb-name';
        const displayName = r.display_name || r.email?.split('@')[0] || 'Trader';
        name.textContent = displayName + (isMe ? ' ' : '');
        if (isMe) {
          const badge = document.createElement('span');
          badge.className = 'lb-you-badge';
          badge.textContent = 'you';
          name.appendChild(badge);
        }
        row.appendChild(name);
        
        const meta = document.createElement('div');
        meta.className = 'lb-meta';
        meta.innerHTML = `<span class="lb-wr ${r.total_pnl>=0?'win-col':'loss-col'}">${pnlStr}</span><span class="lb-pnl">${r.total_trades} trades</span>`;
        row.appendChild(meta);
        
        lbPnl.appendChild(row);
      });
    }
  } catch(e) {
    const err = document.createElement('div');
    err.className = 'lb-empty';
    err.textContent = 'Could not load leaderboard.';
    
    if (lbWr) { lbWr.innerHTML = ''; lbWr.appendChild(err.cloneNode(true)); }
    if (lbPnl) { lbPnl.innerHTML = ''; lbPnl.appendChild(err.cloneNode(true)); }
    console.error(e);
  }
}

function saveLeaderboardOptIn() {
  const checked = document.getElementById('lb-opt-in').checked;
  localStorage.setItem('nxuu_lb_optin', checked);
}

// ── SETTINGS ──────────────────────────────────────────────────
async function saveDisplayName() {
  const input = document.getElementById('display-name-input');
  const btn   = document.getElementById('display-name-btn');
  const msg   = document.getElementById('display-name-msg');
  const name  = input.value.trim();
  
  if (!name) return;
  
  const error = Validators.displayName(name);
  if (error) {
    msg.textContent = error; msg.className = 'auth-msg error';
    return;
  }
  
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    await updateUserDisplayName(name);
    document.getElementById('user-email').textContent = name;
    msg.textContent = 'Saved!'; msg.className = 'auth-msg success';
    setTimeout(()=>{ msg.textContent=''; msg.className='auth-msg'; }, 3000);
  } catch(e) {
    msg.textContent = e.message; msg.className = 'auth-msg error';
  } finally {
    btn.disabled = false; btn.textContent = 'Save';
  }
}

function renderSettings() {
  // Steps list
  const stepsEl = document.getElementById('steps-manage-list');
  if (stepsEl) {
    stepsEl.innerHTML = '';
    if (userSteps.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No steps yet.';
      stepsEl.appendChild(empty);
    } else {
      userSteps.forEach(s => {
        const row = document.createElement('div');
        row.className = 'manage-row';
        row.innerHTML = `<div class="manage-row-info"><span class="manage-row-section">${escapeHtml(s.section)}</span><span class="manage-row-title">${escapeHtml(s.title)}</span></div>`;
        
        const btn = document.createElement('button');
        btn.className = 'delete-btn';
        btn.type = 'button';
        btn.textContent = '✕';
        btn.onclick = () => removeStep(s.id);
        row.appendChild(btn);
        
        stepsEl.appendChild(row);
      });
    }
  }
  
  // Models list
  const modelsEl = document.getElementById('models-manage-list');
  if (modelsEl) {
    modelsEl.innerHTML = '';
    if (userModels.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No models yet.';
      modelsEl.appendChild(empty);
    } else {
      userModels.forEach(m => {
        const row = document.createElement('div');
        row.className = 'manage-row';
        row.innerHTML = `<div class="manage-row-info"><span class="manage-row-title">${escapeHtml(m.name)}</span></div>`;
        
        const btn = document.createElement('button');
        btn.className = 'delete-btn';
        btn.type = 'button';
        btn.textContent = '✕';
        btn.onclick = () => removeModel(m.id);
        row.appendChild(btn);
        
        modelsEl.appendChild(row);
      });
    }
  }
  
  const dnInput = document.getElementById('display-name-input');
  if (dnInput) dnInput.value = getUserDisplayName();
  
  const isDark = document.documentElement.getAttribute('data-theme')==='dark';
  const dt = document.getElementById('dark-mode-toggle'); 
  if(dt) dt.checked=isDark;
  
  const optIn = localStorage.getItem('nxuu_lb_optin')==='true';
  const lb = document.getElementById('lb-opt-in'); 
  if(lb) lb.checked=optIn;
  
  const sbInput = document.getElementById('starting-balance-input');
  if(sbInput) sbInput.value = localStorage.getItem('nxuu_starting_balance') || '';
}

async function addStep() {
  const section=document.getElementById('new-step-section').value.trim(), title=document.getElementById('new-step-title').value.trim();
  
  let error = Validators.checklistSection(section);
  if (error) return alert(error);
  
  error = Validators.checklistTitle(title);
  if (error) return alert(error);
  
  try { 
    await insertStep(section, title, userSteps.length); 
    document.getElementById('new-step-section').value=''; 
    document.getElementById('new-step-title').value=''; 
    await loadSteps(); 
    renderSettings();
  }
  catch(e){ alert('Could not add step.'); }
}

async function removeStep(id) { 
  if(!confirm('Delete this step?'))return; 
  try{await deleteStep(id);await loadSteps();renderSettings();}catch(e){alert('Could not delete step.');} 
}

async function addModel() { 
  const name=document.getElementById('new-model-name').value.trim(); 
  
  const error = Validators.modelName(name);
  if (error) return alert(error);
  
  try{
    await insertModel(name);
    document.getElementById('new-model-name').value='';
    await loadModels();
    renderSettings();
  }catch(e){alert('Could not add model.');} 
}

async function removeModel(id) { 
  if(!confirm('Delete this model?'))return; 
  try{await deleteModel(id);await loadModels();renderSettings();}catch(e){alert('Could not delete model.');} 
}

// ── CSV EXPORT ────────────────────────────────────────────────
function escapeCsvField(value) {
  if (value === null || value === undefined) {
    return '';
  }
  
  const str = String(value);
  
  // Block formula injections
  if (/^[=+\-@\t]/.test(str)) {
    return "'" + str;
  }
  
  // Escape quotes and wrap if contains special chars
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  
  return str;
}

function exportCSV() {
  if(allTrades.length===0)return alert('No trades to export.');
  
  const headers=['Date','Result','R Value','PnL (USD)','Account','Model','Session','Notes'];
  const rows=allTrades.map(t=>[
    escapeCsvField(t.date),
    escapeCsvField(t.result),
    escapeCsvField(t.r_value),
    escapeCsvField(t.pnl_usd),
    escapeCsvField(t.account),
    escapeCsvField(t.model),
    escapeCsvField(t.session),
    escapeCsvField(t.notes)
  ]);
  
  const csv=[headers,...rows].map(r=>r.join(',')).join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link=document.createElement('a');
  link.href=URL.createObjectURL(blob);
  link.download=`nxuu-trades-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initDarkMode();

  document.querySelectorAll('.tab-btn').forEach(btn=>{
    btn.addEventListener('click',()=>switchTab(btn.dataset.tab));
  });

  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) resetBtn.addEventListener('click', resetChecklist);
  
  initForm();
  
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) submitBtn.addEventListener('click', submitTrade);
  
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', loadTrades);
  
  const calPrev = document.getElementById('cal-prev');
  const calNext = document.getElementById('cal-next');
  if (calPrev) calPrev.addEventListener('click',()=>{ calMonth--;if(calMonth<1){calMonth=12;calYear--;}renderCalendar(); });
  if (calNext) calNext.addEventListener('click',()=>{ calMonth++;if(calMonth>12){calMonth=1;calYear++;}renderCalendar(); });

  document.addEventListener('touchstart', unlockAudio, {once:true,passive:true});
  document.addEventListener('touchend',   unlockAudio, {once:true,passive:true});

  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeTradeModal(); });

  if (!isConfigured()) {
    document.getElementById('auth-screen').style.display = 'flex';
    return;
  }

  const hash = window.location.hash;
  if (hash && hash.includes('access_token')) {
    const params       = new URLSearchParams(hash.replace('#',''));
    const accessToken  = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const type         = params.get('type');
    if (accessToken) {
      try {
        await setSessionFromTokens(accessToken, refreshToken);
        history.replaceState(null,'',window.location.pathname);
        if (type==='recovery') {
          await bootApp();
          return;
        }
        if (type==='signup') {
          showAuthTab('signin');
          setAuthMsg(document.getElementById('signin-msg'),'Email confirmed! Signing you in…','success');
        }
        await bootApp();
        return;
      } catch(e) { console.error('Token restore failed:',e); }
    }
  }

  if (restoreSession()) { await bootApp(); }
  else { document.getElementById('auth-screen').style.display='flex'; }
});
