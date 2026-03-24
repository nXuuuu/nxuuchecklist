/**
 * nXuu — supabase.js
 * All Supabase connection, auth and database queries.
 * ─────────────────────────────────────────────────
 * Replace the two lines below with your own values
 * from Supabase → Settings → API
 * ─────────────────────────────────────────────────
 */

'use strict';

const SUPABASE_URL      = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// ── HELPERS ───────────────────────────────────────────────────
function isConfigured() {
  return SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
         SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';
}

function authHeaders(token) {
  return {
    'Content-Type':  'application/json',
    'apikey':        SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${token}`,
  };
}

// ── AUTH STATE ────────────────────────────────────────────────
let _session = null;

function getSession()  { return _session; }
function getToken()    { return _session?.access_token || SUPABASE_ANON_KEY; }
function getUserId()   { return _session?.user?.id || null; }
function getUserEmail(){ return _session?.user?.email || ''; }

/**
 * Sign up with email + password.
 */
async function signUp(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
    body:    JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || data.msg || 'Sign up failed');
  return data;
}

/**
 * Sign in with email + password.
 */
async function signIn(email, password) {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
      body:    JSON.stringify({ email, password }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error || 'Sign in failed');
  _session = data;
  localStorage.setItem('nxuu_session', JSON.stringify(data));
  return data;
}

/**
 * Sign out — clear session.
 */
async function signOut() {
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method:  'POST',
      headers: authHeaders(getToken()),
    });
  } catch(e) {}
  _session = null;
  localStorage.removeItem('nxuu_session');
}

/**
 * Restore session from localStorage on page load.
 * Returns true if a valid session was found.
 */
function restoreSession() {
  try {
    const raw = localStorage.getItem('nxuu_session');
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s?.access_token) return false;
    _session = s;
    return true;
  } catch(e) {
    return false;
  }
}

// ── TRADES ────────────────────────────────────────────────────
async function insertTrade(trade) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/trades`, {
    method:  'POST',
    headers: { ...authHeaders(getToken()), 'Prefer': 'return=representation' },
    body:    JSON.stringify({ ...trade, user_id: getUserId() }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function fetchAllTrades() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/trades?select=*&order=date.desc,created_at.desc`,
    { headers: authHeaders(getToken()) }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function fetchTradesByMonth(year, month) {
  const from    = `${year}-${String(month).padStart(2,'0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to      = `${year}-${String(month).padStart(2,'0')}-${lastDay}`;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/trades?select=*&date=gte.${from}&date=lte.${to}&order=date.asc`,
    { headers: authHeaders(getToken()) }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function deleteTrade(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/trades?id=eq.${id}`, {
    method:  'DELETE',
    headers: authHeaders(getToken()),
  });
  if (!res.ok) throw new Error(await res.text());
}

// ── CHECKLIST STEPS ───────────────────────────────────────────
async function fetchSteps() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/checklist_steps?select=*&order=position.asc`,
    { headers: authHeaders(getToken()) }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function insertStep(section, title, position) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/checklist_steps`, {
    method:  'POST',
    headers: { ...authHeaders(getToken()), 'Prefer': 'return=representation' },
    body:    JSON.stringify({ user_id: getUserId(), section, title, position }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function updateStep(id, fields) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/checklist_steps?id=eq.${id}`, {
    method:  'PATCH',
    headers: { ...authHeaders(getToken()), 'Prefer': 'return=representation' },
    body:    JSON.stringify(fields),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function deleteStep(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/checklist_steps?id=eq.${id}`, {
    method:  'DELETE',
    headers: authHeaders(getToken()),
  });
  if (!res.ok) throw new Error(await res.text());
}

// ── ENTRY MODELS ──────────────────────────────────────────────
async function fetchModels() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/entry_models?select=*&order=created_at.asc`,
    { headers: authHeaders(getToken()) }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function insertModel(name) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/entry_models`, {
    method:  'POST',
    headers: { ...authHeaders(getToken()), 'Prefer': 'return=representation' },
    body:    JSON.stringify({ user_id: getUserId(), name }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function deleteModel(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/entry_models?id=eq.${id}`, {
    method:  'DELETE',
    headers: authHeaders(getToken()),
  });
  if (!res.ok) throw new Error(await res.text());
}
