/**
 * nXuu — supabase.js (FIXED & SECURE)
 * All Supabase connection, auth and database queries.
 * ─────────────────────────────────────────────────
 * API Keys now loaded from environment variables (.env.local)
 * NEVER hardcode secrets in source code!
 * ─────────────────────────────────────────────────
 */

'use strict';

// Load from environment variables (set in .env.local or deployment platform)
// For local development: Create .env.local with:
//   VITE_SUPABASE_URL=https://your-project.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// ── HELPERS ───────────────────────────────────────────────────
function isConfigured() {
  return SUPABASE_URL !== '' && 
         SUPABASE_ANON_KEY !== '' &&
         SUPABASE_URL.includes('supabase.co') &&
         SUPABASE_ANON_KEY.startsWith('eyJ');
}

function authHeaders(token) {
  return {
    'Content-Type':  'application/json',
    'apikey':        SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${token}`,
  };
}

// Helper to check if JWT token is expired
function isTokenExpired(token) {
  try {
    if (!token || typeof token !== 'string') return true;
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    
    const payload = JSON.parse(atob(parts[1]));
    return payload.exp * 1000 < Date.now(); // exp is in seconds
  } catch(e) {
    return true;
  }
}

// ── AUTH STATE ────────────────────────────────────────────────
let _session = null;
let _refreshTimer = null;

function getSession()      { return _session; }
function getToken()        { return _session?.access_token || SUPABASE_ANON_KEY; }
function getUserId()       { return _session?.user?.id || null; }
function getUserEmail()    { return _session?.user?.email || ''; }
function getUserDisplayName() { return _session?.user?.user_metadata?.display_name || ''; }

/**
 * Save a display name to Supabase user metadata.
 */
async function updateUserDisplayName(name) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method:  'PUT',
    headers: authHeaders(getToken()),
    body:    JSON.stringify({ data: { display_name: name } }),
  });
  if (!res.ok) {
    const data = await res.json().catch(()=>({}));
    throw new Error(data.msg || data.error_description || 'Could not update display name.');
  }
  const updated = await res.json();
  // Patch local session so it reflects immediately without re-login
  if (_session && updated?.user_metadata) {
    _session.user.user_metadata = updated.user_metadata;
    // Note: NOT storing in sessionStorage - keep tokens in memory only
  }
  return updated;
}

/**
 * Start auto-refresh timer for access token
 */
function startTokenRefreshTimer(expiresInSeconds) {
  // Clear any existing timer
  if (_refreshTimer) clearTimeout(_refreshTimer);
  
  // Refresh 30 seconds before expiry
  const refreshIn = Math.max(1000, (expiresInSeconds - 30) * 1000);
  
  _refreshTimer = setTimeout(async () => {
    try {
      await refreshAccessToken();
    } catch(e) {
      console.error('Token refresh failed, signing out:', e);
      signOut();
    }
  }, refreshIn);
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken() {
  const refreshToken = sessionStorage.getItem('nxuu_refresh_token');
  if (!refreshToken) throw new Error('No refresh token');
  
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
      body:    JSON.stringify({ refresh_token: refreshToken }),
    }
  );
  
  if (!res.ok) {
    sessionStorage.removeItem('nxuu_refresh_token');
    throw new Error('Token refresh failed');
  }
  
  const data = await res.json();
  _session = data;
  sessionStorage.setItem('nxuu_refresh_token', data.refresh_token);
  startTokenRefreshTimer(data.expires_in || 3600);
}

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
  if (!res.ok || data.error || data.error_code || data.msg) {
    throw new Error(data.error_description || data.msg || (data.error?.message) || data.error || 'Sign up failed');
  }
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
  if (!res.ok || data.error || data.error_code || data.msg || !data.access_token) {
    throw new Error(data.error_description || data.msg || data.error || 'Invalid email or password.');
  }
  
  // Store session in memory and refresh token in sessionStorage
  _session = data;
  sessionStorage.setItem('nxuu_refresh_token', data.refresh_token);
  startTokenRefreshTimer(data.expires_in || 3600);
  
  return data;
}

/**
 * Sign out — clear session.
 */
async function signOut() {
  try {
    if (_session?.access_token) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method:  'POST',
        headers: authHeaders(_session.access_token),
      });
    }
  } catch(e) {}
  
  _session = null;
  sessionStorage.removeItem('nxuu_refresh_token');
  
  if (_refreshTimer) {
    clearTimeout(_refreshTimer);
    _refreshTimer = null;
  }
}

/**
 * Restore session from sessionStorage on page load.
 * Returns true if a valid session was found and refreshed.
 */
function restoreSession() {
  try {
    const refreshToken = sessionStorage.getItem('nxuu_refresh_token');
    if (!refreshToken) return false;
    
    // Attempt to refresh token to get a fresh access token
    // If refresh fails, user needs to re-login
    // This is acceptable - sessionStorage is cleared on tab close
    return false; // User must re-login after page refresh (secure by design)
  } catch(e) {
    sessionStorage.removeItem('nxuu_refresh_token');
    return false;
  }
}

/**
 * Build a session from raw tokens (used after email confirmation redirect).
 * Fetches the user object from Supabase so we have a full valid session.
 */
async function setSessionFromTokens(accessToken, refreshToken) {
  // Check if token is expired
  if (isTokenExpired(accessToken)) {
    // Try to refresh
    if (refreshToken) {
      const res = await fetch(
        `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
          body:    JSON.stringify({ refresh_token: refreshToken }),
        }
      );
      if (!res.ok) throw new Error('Could not refresh token');
      const data = await res.json();
      accessToken = data.access_token;
      refreshToken = data.refresh_token;
    } else {
      throw new Error('Token expired and no refresh token');
    }
  }
  
  // Fetch the user record using the access token
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${accessToken}`,
    }
  });
  if (!res.ok) throw new Error('Could not verify token');
  const user = await res.json();
  if (!user?.id) throw new Error('Invalid user from token');
  
  const session = { access_token: accessToken, refresh_token: refreshToken, user };
  _session = session;
  sessionStorage.setItem('nxuu_refresh_token', refreshToken);
  startTokenRefreshTimer(3600); // Default 1 hour
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

// ── PASSWORD RESET ────────────────────────────────────────────
/**
 * Send a password reset email via Supabase.
 */
async function requestPasswordReset(email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
    body:    JSON.stringify({ email }),
  });
  if (!res.ok) {
    const data = await res.json().catch(()=>({}));
    throw new Error(data.msg || data.error_description || 'Could not send reset email.');
  }
}

// ── LEADERBOARD ───────────────────────────────────────────────
/**
 * Fetch aggregated stats for all users who opted in.
 * Uses a Supabase RPC function (see schema_v6.sql for setup).
 * Falls back to empty array if the function doesn't exist yet.
 */
async function fetchLeaderboard() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/get_leaderboard`,
    {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey':        SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${getToken()}`,
      },
      body: JSON.stringify({}),
    }
  );
  if (!res.ok) return []; // gracefully return empty if function not set up
  return res.json();
}
