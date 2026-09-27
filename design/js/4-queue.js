/**
 * QureFlow Design System — Screen 5: Patient Live Queue & Dynamic ETA Tracker Logic
 * Simulates real-time WebSocket sync, dynamic ETA range calculations, lifecycle stepper, and turn alerts.
 */

let isDoctorOnBreak = false;
let currentQueueStep = 'in_queue'; // 'in_queue' | 'next' | 'turn' | 'done'

document.addEventListener('DOMContentLoaded', () => {
  // Initial state setup
});

/* ==========================================================================
   Queue Lifecycle State Transitions
   ========================================================================== */
function setQueueLifecycleState(step) {
  currentQueueStep = step;

  // Update tester buttons
  ['inqueue', 'next', 'turn', 'done'].forEach(s => {
    const btn = document.getElementById(`btn-state-${s}`);
    if (btn) btn.classList.toggle('active', (s === 'inqueue' && step === 'in_queue') || s === step);
  });

  const aheadElem = document.getElementById('metric-ahead');
  const etaElem = document.getElementById('metric-eta');
  const servingElem = document.getElementById('metric-serving');
  const alertElem = document.getElementById('proximity-alert');
  const progressFill = document.getElementById('stepper-progress-fill');
  const turnModal = document.getElementById('turn-alert-modal');
  const statusBadge = document.getElementById('token-status-badge');

  // Reset Stepper
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById(`step-${i}`);
    if (el) el.className = 'step-item';
  }

  if (step === 'in_queue') {
    if (aheadElem) aheadElem.textContent = '2';
    if (etaElem) etaElem.textContent = isDoctorOnBreak ? '30–40m' : '20–30m';
    if (servingElem) servingElem.textContent = '#A-15';
    if (alertElem) alertElem.style.display = 'none';
    if (turnModal) turnModal.style.display = 'none';
    if (progressFill) progressFill.style.width = '50%';
    if (statusBadge) {
      statusBadge.innerHTML = '<i class="fa-solid fa-circle-dot"></i> IN PHYSICAL QUEUE';
      statusBadge.className = 'badge badge-blue';
    }

    document.getElementById('step-1').className = 'step-item completed';
    document.getElementById('step-2').className = 'step-item completed';
    document.getElementById('step-3').className = 'step-item active';
  } 
  else if (step === 'next') {
    if (aheadElem) aheadElem.textContent = '1';
    if (etaElem) etaElem.textContent = isDoctorOnBreak ? '20–25m' : '10–15m';
    if (servingElem) servingElem.textContent = '#A-16';
    if (alertElem) alertElem.style.display = 'block';
    if (turnModal) turnModal.style.display = 'none';
    if (progressFill) progressFill.style.width = '50%';
    if (statusBadge) {
      statusBadge.innerHTML = '<i class="fa-solid fa-bell"></i> YOU ARE NEXT';
      statusBadge.className = 'badge badge-amber';
    }

    document.getElementById('step-1').className = 'step-item completed';
    document.getElementById('step-2').className = 'step-item completed';
    document.getElementById('step-3').className = 'step-item active';
  } 
  else if (step === 'turn') {
    if (aheadElem) aheadElem.textContent = '0';
    if (etaElem) etaElem.textContent = 'Now';
    if (servingElem) servingElem.textContent = '#A-17 (You)';
    if (alertElem) alertElem.style.display = 'none';
    if (turnModal) turnModal.style.display = 'flex';
    if (progressFill) progressFill.style.width = '75%';
    if (statusBadge) {
      statusBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> IN CONSULTATION';
      statusBadge.className = 'badge badge-green';
    }

    document.getElementById('step-1').className = 'step-item completed';
    document.getElementById('step-2').className = 'step-item completed';
    document.getElementById('step-3').className = 'step-item completed';
    document.getElementById('step-4').className = 'step-item active';
  } 
  else if (step === 'done') {
    if (aheadElem) aheadElem.textContent = '0';
    if (etaElem) etaElem.textContent = 'Done';
    if (servingElem) servingElem.textContent = '#A-18';
    if (alertElem) alertElem.style.display = 'none';
    if (turnModal) turnModal.style.display = 'none';
    if (progressFill) progressFill.style.width = '100%';
    if (statusBadge) {
      statusBadge.innerHTML = '<i class="fa-solid fa-flag-checkered"></i> VISIT COMPLETED';
      statusBadge.className = 'badge badge-green';
    }

    for (let i = 1; i <= 5; i++) {
      document.getElementById(`step-${i}`).className = 'step-item completed';
    }
  }
}

/* ==========================================================================
   Doctor Break Toggle (Simulates real-time ETA adjustment)
   ========================================================================== */
function toggleDoctorBreak() {
  isDoctorOnBreak = !isDoctorOnBreak;
  const breakBtn = document.getElementById('btn-state-break');
  if (breakBtn) breakBtn.classList.toggle('active', isDoctorOnBreak);

  const statusPill = document.getElementById('doctor-status-pill');
  const etaElem = document.getElementById('metric-eta');

  if (isDoctorOnBreak) {
    statusPill.innerHTML = '<span class="badge badge-amber"><i class="fa-solid fa-mug-hot"></i> Doctor on 10m Break</span>';
    if (currentQueueStep === 'in_queue' && etaElem) etaElem.textContent = '30–40m';
    if (currentQueueStep === 'next' && etaElem) etaElem.textContent = '20–25m';
  } else {
    statusPill.innerHTML = '<span class="badge badge-green"><i class="fa-solid fa-circle-check"></i> Consulting (#A-15)</span>';
    if (currentQueueStep === 'in_queue' && etaElem) etaElem.textContent = '20–30m';
    if (currentQueueStep === 'next' && etaElem) etaElem.textContent = '10–15m';
  }
}

/* ==========================================================================
   Manual Refresh CTA
   ========================================================================== */
function manualRefreshStatus() {
  const btn = document.querySelector('.btn-primary');
  if (!btn) return;
  const original = btn.innerHTML;

  btn.disabled = true;
  btn.style.opacity = '0.85';
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Syncing with Live Queue...</span>';

  setTimeout(() => {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.innerHTML = original;
  }, 700);
}

function dismissTurnModal() {
  const modal = document.getElementById('turn-alert-modal');
  if (modal) modal.style.display = 'none';
}

function confirmCancelQueue() {
  if (confirm('Leave queue? Your live token #A-17 will be released and given to the next waiting patient.')) {
    window.location.href = 'patient-home.html';
  }
}

// Backward compatibility alias
function setQueueState(state) {
  if (state === 'success') setQueueLifecycleState('turn');
  else if (state === 'empty') confirmCancelQueue();
  else setQueueLifecycleState('in_queue');
}
