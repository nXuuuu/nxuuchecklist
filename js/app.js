/**
 * nXuu CheckList — app.js
 * Author  : @_nxuu_
 * Version : 4.0
 * Features: confetti, step animations, sound effects,
 *           motivational quotes, notes field
 */

'use strict';

// ── CONSTANTS ─────────────────────────────────────────────────
const TOTAL = 10;

// ── DOM REFS ──────────────────────────────────────────────────
const progBig   = document.getElementById('prog-big');
const progFill  = document.getElementById('fill');
const progTrack = document.querySelector('.prog-track');
const resetBtn  = document.getElementById('resetBtn');
const notesTxt  = document.getElementById('notesTxt');
const quoteEl   = document.getElementById('quote');

// ── QUOTES ────────────────────────────────────────────────────
const QUOTES = [
  "The goal is not to predict the market, it's to react correctly.",
  "Patience is not waiting — it's how you act while waiting.",
  "A good trader is not someone who is never wrong, but someone who manages being wrong.",
  "The market pays you to be disciplined and consistent.",
  "Your job is not to trade every setup. Your job is to trade the right setup.",
  "Risk management is what separates professionals from gamblers.",
  "Follow the rule. Every. Single. Time.",
  "No setup? No trade. Simple as that.",
  "Discipline now. Profits later.",
  "The best trade is sometimes no trade.",
  "Liquidity → Displacement → MSS → Entry. Trust the process.",
  "Protect the 1%. Always.",
  "Small losses are tuition fees. Big losses are avoidable.",
  "You don't need to trade every day. You need to trade every setup correctly.",
  "A loss taken with discipline is better than a win taken without it.",
];

// ── SOUND ENGINE ──────────────────────────────────────────────
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioCtx();
  return audioCtx;
}

function playTick() {
  try {
    const ctx  = getAudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 600;
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  } catch (e) {}
}

function playUncheck() {
  try {
    const ctx  = getAudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 350;
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  } catch (e) {}
}

function playFanfare() {
  try {
    const ctx   = getAudioCtx();
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.22, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
      osc.start(start);
      osc.stop(start + 0.3);
    });
  } catch (e) {}
}

// ── CONFETTI ──────────────────────────────────────────────────
const CONFETTI_COLORS = [
  '#6b7a52','#8a9a6a','#c8d4b0',
  '#a08040','#c8a84b','#e0c878',
  '#4a6a8a','#8a6a2a','#6a4a8a',
  '#f2ede4','#1e1c18',
];

function fireConfetti() {
  const container = document.getElementById('confetti-container');
  container.innerHTML = '';

  for (let i = 0; i < 90; i++) {
    const piece  = document.createElement('div');
    piece.className = 'confetti-piece';
    const color  = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    const size   = Math.random() * 8 + 5;
    const isRect = Math.random() > 0.5;
    piece.style.cssText = `
      left: ${Math.random() * 100}vw;
      width: ${size}px;
      height: ${isRect ? size * 2.5 : size}px;
      background: ${color};
      border-radius: ${isRect ? '2px' : '50%'};
      animation-delay: ${Math.random() * 0.6}s;
      animation-duration: ${Math.random() * 1.5 + 1.8}s;
      --drift: ${Math.random() * 140 - 70}px;
      --rotate: ${Math.random() * 720 - 360}deg;
    `;
    container.appendChild(piece);
  }

  setTimeout(() => { container.innerHTML = ''; }, 5000);
}

// ── COMPLETE BANNER ───────────────────────────────────────────
function showCompleteBanner() {
  document.getElementById('complete-banner').classList.add('visible');
}

function hideCompleteBanner() {
  document.getElementById('complete-banner').classList.remove('visible');
}

// ── CORE LOGIC ────────────────────────────────────────────────
function tog(el) {
  el.classList.toggle('checked');
  const isChecked = el.classList.contains('checked');
  el.setAttribute('aria-checked', isChecked);

  // Bounce animation — remove then re-add to restart it
  el.classList.remove('bounce');
  void el.offsetWidth;
  el.classList.add('bounce');

  isChecked ? playTick() : playUncheck();
  updateProgress();
}

function handleKey(event, el) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    tog(el);
  }
}

function updateProgress() {
  const done = document.querySelectorAll('.step.checked').length;
  progBig.innerHTML    = `${done}<span> / ${TOTAL}</span>`;
  progFill.style.width = `${Math.round((done / TOTAL) * 100)}%`;
  progTrack.setAttribute('aria-valuenow', done);

  if (done === TOTAL) {
    fireConfetti();
    playFanfare();
    showCompleteBanner();
  } else {
    hideCompleteBanner();
  }
}

function resetAll() {
  document.querySelectorAll('.step').forEach((s) => {
    s.classList.remove('checked', 'bounce');
    s.setAttribute('aria-checked', 'false');
  });
  if (notesTxt) notesTxt.value = '';
  hideCompleteBanner();
  updateProgress();
  rollQuote();
}

// ── NOTES ─────────────────────────────────────────────────────
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

// ── QUOTES ────────────────────────────────────────────────────
function rollQuote() {
  if (!quoteEl) return;
  quoteEl.style.opacity = '0';
  setTimeout(() => {
    quoteEl.textContent = `"${QUOTES[Math.floor(Math.random() * QUOTES.length)]}"`;
    quoteEl.style.opacity = '1';
  }, 200);
}

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  document.querySelectorAll('.step').forEach((step) => {
    step.setAttribute('role', 'checkbox');
    step.setAttribute('aria-checked', 'false');
  });

  resetBtn.addEventListener('click', resetAll);

  if (notesTxt) {
    notesTxt.addEventListener('input', () => autoResize(notesTxt));
  }

  rollQuote();
});
