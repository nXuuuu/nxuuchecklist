/**
 * nXuu CheckList — app.js
 * Author  : @_nxuu_
 * Version : 2.0
 */

const TOTAL = 10;

const progBig  = document.getElementById('prog-big');
const progFill = document.getElementById('fill');
const progTrack = document.querySelector('.prog-track');
const resetBtn = document.getElementById('resetBtn');

/**
 * Toggle a step's checked state and update progress.
 * @param {HTMLElement} el - The step element clicked.
 */
function tog(el) {
  el.classList.toggle('checked');

  // Accessibility: update aria-checked state
  const isChecked = el.classList.contains('checked');
  el.setAttribute('aria-checked', isChecked);

  updateProgress();
}

/**
 * Allow keyboard activation (Enter / Space) for accessibility.
 * @param {KeyboardEvent} event
 * @param {HTMLElement} el
 */
function handleKey(event, el) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    tog(el);
  }
}

/**
 * Recalculate and render progress bar + counter.
 */
function updateProgress() {
  const done = document.querySelectorAll('.step.checked').length;
  const pct  = Math.round((done / TOTAL) * 100);

  progBig.innerHTML  = `${done}<span> / ${TOTAL}</span>`;
  progFill.style.width = `${pct}%`;

  // Update ARIA on the progress track
  progTrack.setAttribute('aria-valuenow', done);
}

/**
 * Reset all steps back to unchecked.
 */
function resetAll() {
  document.querySelectorAll('.step').forEach((step) => {
    step.classList.remove('checked');
    step.setAttribute('aria-checked', 'false');
  });
  updateProgress();
}

// ── EVENT LISTENERS ──────────────────────────────────────────
resetBtn.addEventListener('click', resetAll);

// Initialise ARIA states on page load
document.querySelectorAll('.step').forEach((step) => {
  step.setAttribute('role', 'checkbox');
  step.setAttribute('aria-checked', 'false');
});
