/**
 * QureFlow — Screen 1: Authentication & Role Gateway
 * JS Controller (Vanilla JS — prototype/design layer only)
 *
 * Tech Stack (Production): React + Context API + React Router
 * Auth: email/username + password → JWT (NO OTP, NO phone, NO SMS)
 * Validation: Mirrors Joi schema defined in backend AuthController
 */

// =====================================================
// STATE
// =====================================================
let currentRole = 'patient';       // 'patient' | 'staff'
let currentPatientMode = 'login';  // 'login' | 'register'
let selectedStaffSubrole = 'DOCTOR';
let isLoading = false;

// =====================================================
// ROLE SWITCHER
// =====================================================
function switchRole(role) {
  currentRole = role;

  const patientPanel = document.getElementById('patient-panel');
  const staffForm = document.getElementById('staff-form');
  const tabPatient = document.getElementById('tab-patient');
  const tabStaff = document.getElementById('tab-staff');
  const roleSubtitle = document.getElementById('role-subtitle');
  const rolePatientBtn = document.getElementById('role-patient-btn');
  const roleStaffBtn = document.getElementById('role-staff-btn');

  clearAlert();

  if (role === 'patient') {
    patientPanel.style.display = 'block';
    staffForm.style.display = 'none';
    tabPatient.classList.add('active');
    tabPatient.setAttribute('aria-selected', 'true');
    tabStaff.classList.remove('active');
    tabStaff.setAttribute('aria-selected', 'false');
    roleSubtitle.textContent = 'Sign in or create your patient account';
    if (rolePatientBtn) rolePatientBtn.classList.add('active');
    if (roleStaffBtn) roleStaffBtn.classList.remove('active');
  } else {
    patientPanel.style.display = 'none';
    staffForm.style.display = 'block';
    tabPatient.classList.remove('active');
    tabPatient.setAttribute('aria-selected', 'false');
    tabStaff.classList.add('active');
    tabStaff.setAttribute('aria-selected', 'true');
    roleSubtitle.textContent = 'Clinic staff & doctor secure sign-in portal';
    if (rolePatientBtn) rolePatientBtn.classList.remove('active');
    if (roleStaffBtn) roleStaffBtn.classList.add('active');
    updateStaffCTA();
  }
}

// =====================================================
// PATIENT MODE SWITCHER (Login ↔ Register)
// =====================================================
function switchPatientMode(mode) {
  currentPatientMode = mode;

  const loginForm = document.getElementById('patient-login-form');
  const registerForm = document.getElementById('patient-register-form');
  const loginTab = document.getElementById('mode-tab-login');
  const registerTab = document.getElementById('mode-tab-register');
  const loginModeBtn = document.getElementById('mode-login-btn');
  const registerModeBtn = document.getElementById('mode-register-btn');

  clearAlert();

  if (mode === 'login') {
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    loginTab.classList.add('active');
    loginTab.setAttribute('aria-selected', 'true');
    registerTab.classList.remove('active');
    registerTab.setAttribute('aria-selected', 'false');
    if (loginModeBtn) loginModeBtn.classList.add('active');
    if (registerModeBtn) registerModeBtn.classList.remove('active');
  } else {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    loginTab.classList.remove('active');
    loginTab.setAttribute('aria-selected', 'false');
    registerTab.classList.add('active');
    registerTab.setAttribute('aria-selected', 'true');
    if (loginModeBtn) loginModeBtn.classList.remove('active');
    if (registerModeBtn) registerModeBtn.classList.add('active');
  }
}

// =====================================================
// STAFF SUBROLE SELECTOR
// =====================================================
function selectStaffSubrole(role) {
  selectedStaffSubrole = role;
  document.getElementById('subrole-doctor').classList.toggle('active', role === 'DOCTOR');
  document.getElementById('subrole-reception').classList.toggle('active', role === 'RECEPTIONIST');
  updateStaffCTA();
}

function updateStaffCTA() {
  const ctaText = document.getElementById('staff-cta-text');
  if (ctaText) {
    ctaText.textContent = selectedStaffSubrole === 'DOCTOR'
      ? 'Sign In to Doctor Console'
      : 'Sign In to Reception Desk';
  }
}

// =====================================================
// PASSWORD VISIBILITY TOGGLE
// =====================================================
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  const icon = btn.querySelector('i');
  if (!input || !icon) return;

  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fa-solid fa-eye-slash';
    btn.setAttribute('aria-label', 'Hide password');
  } else {
    input.type = 'password';
    icon.className = 'fa-solid fa-eye';
    btn.setAttribute('aria-label', 'Show password');
  }
}

// =====================================================
// PASSWORD STRENGTH INDICATOR
// =====================================================
function updatePasswordStrength(value) {
  const indicator = document.getElementById('password-strength-indicator');
  const fill = document.getElementById('strength-fill');
  const label = document.getElementById('strength-label');

  if (!indicator || !fill || !label) return;

  if (value.length === 0) {
    indicator.classList.remove('visible');
    return;
  }

  indicator.classList.add('visible');

  let score = 0;
  if (value.length >= 8) score++;
  if (/[A-Z]/.test(value)) score++;
  if (/[0-9]/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;

  fill.className = 'strength-fill';
  label.className = 'strength-label';

  if (score <= 1) {
    fill.classList.add('weak');
    label.classList.add('weak');
    label.textContent = 'Weak — add uppercase, numbers, or symbols';
  } else if (score <= 2) {
    fill.classList.add('fair');
    label.classList.add('fair');
    label.textContent = 'Fair — getting stronger';
  } else {
    fill.classList.add('strong');
    label.classList.add('strong');
    label.textContent = 'Strong password';
  }
}

// =====================================================
// INPUT VALIDATORS (mirrors Joi backend schema)
// =====================================================
function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function isValidUsername(v) {
  return /^[a-zA-Z0-9_]{3,30}$/.test(v.trim());
}

function isValidIdentifier(v) {
  v = v.trim();
  return v.length >= 3; // accepts email or username
}

// =====================================================
// PATIENT LOGIN — Input Watch
// =====================================================
function onLoginInput() {
  const identifier = document.getElementById('login-identifier').value.trim();
  const password = document.getElementById('login-password').value;
  const cta = document.getElementById('patient-login-cta');
  if (cta) cta.disabled = !(identifier.length >= 3 && password.length >= 1);
}

// =====================================================
// PATIENT REGISTER — Input Watch
// =====================================================
function onRegisterInput() {
  const name = document.getElementById('reg-name').value.trim();
  const username = document.getElementById('reg-username').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const cta = document.getElementById('patient-register-cta');

  const valid =
    name.length >= 2 &&
    isValidUsername(username) &&
    isValidEmail(email) &&
    password.length >= 8;

  if (cta) cta.disabled = !valid;
}

// =====================================================
// STAFF — Input Watch
// =====================================================
function onStaffInput() {
  const email = document.getElementById('staff-email').value.trim();
  const password = document.getElementById('staff-pass').value;
  const cta = document.getElementById('staff-primary-cta');
  if (cta) cta.disabled = !(isValidEmail(email) && password.length >= 1);
}

// =====================================================
// PATIENT LOGIN — Submit Handler
// =====================================================
function handlePatientLogin(event) {
  event.preventDefault();
  if (isLoading) return;

  clearAlert();
  const identifier = document.getElementById('login-identifier').value.trim();
  const password = document.getElementById('login-password').value;

  // --- Client-side Joi mirror validation ---
  if (!isValidIdentifier(identifier)) {
    return showAlert('error', '<i class="fa-solid fa-triangle-exclamation"></i> Please enter a valid email address or username.');
  }
  if (password.length < 1) {
    return showAlert('error', '<i class="fa-solid fa-triangle-exclamation"></i> Please enter your password.');
  }

  // --- Simulate API: POST /api/v1/auth/login ---
  setLoading(true, 'patient-login-cta', 'patient-login-cta-text', 'Signing in...');

  setTimeout(() => {
    setLoading(false, 'patient-login-cta', 'patient-login-cta-text', 'Sign In');

    // Simulate: setScreenState determines response
    const state = getCurrentSimState();

    if (state === 'error') {
      showAlert('error', '<i class="fa-solid fa-circle-xmark"></i> Invalid email/username or password. Please try again.');
    } else {
      // Success: store simulated JWT and redirect
      showAlert('success', '<i class="fa-solid fa-circle-check"></i> Signed in successfully! Redirecting to your dashboard…');
      localStorage.setItem('qureflow_token', 'simulated-jwt-patient-token');
      localStorage.setItem('qureflow_user', JSON.stringify({ role: 'PATIENT', name: 'Rahul Verma', identifier }));
      setTimeout(() => { window.location.href = 'patient-home.html'; }, 1200);
    }
  }, 1400);
}

// =====================================================
// PATIENT REGISTER — Submit Handler
// =====================================================
function handlePatientRegister(event) {
  event.preventDefault();
  if (isLoading) return;

  clearAlert();
  const name = document.getElementById('reg-name').value.trim();
  const username = document.getElementById('reg-username').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;

  // --- Client-side Joi mirror validation ---
  if (name.length < 2) {
    return showAlert('error', '<i class="fa-solid fa-triangle-exclamation"></i> Please enter your full name (at least 2 characters).');
  }
  if (!isValidUsername(username)) {
    return showAlert('error', '<i class="fa-solid fa-triangle-exclamation"></i> Username must be 3–30 characters: letters, numbers, and underscores only.');
  }
  if (!isValidEmail(email)) {
    return showAlert('error', '<i class="fa-solid fa-triangle-exclamation"></i> Please enter a valid email address.');
  }
  if (password.length < 8) {
    return showAlert('error', '<i class="fa-solid fa-triangle-exclamation"></i> Password must be at least 8 characters.');
  }

  // --- Simulate API: POST /api/v1/auth/register ---
  setLoading(true, 'patient-register-cta', 'patient-register-cta-text', 'Creating account…');

  setTimeout(() => {
    setLoading(false, 'patient-register-cta', 'patient-register-cta-text', 'Create Account');

    const state = getCurrentSimState();

    if (state === 'error') {
      // Simulate 409 Conflict scenarios
      const conflict = Math.random() > 0.5 ? 'email' : 'username';
      if (conflict === 'email') {
        showAlert('error', '<i class="fa-solid fa-circle-xmark"></i> An account with this email already exists. <a href="javascript:void(0)" onclick="switchPatientMode(\'login\')" style="font-weight:600; color:var(--deep-winter-blue);">Try signing in.</a>');
      } else {
        showAlert('error', '<i class="fa-solid fa-circle-xmark"></i> This username is already taken. Please choose another.');
      }
    } else {
      // Success: 201 Created — auto-login
      showAlert('success', '<i class="fa-solid fa-circle-check"></i> Account created! Welcome to QureFlow. Redirecting…');
      localStorage.setItem('qureflow_token', 'simulated-jwt-patient-token');
      localStorage.setItem('qureflow_user', JSON.stringify({ role: 'PATIENT', name, username, email }));
      setTimeout(() => { window.location.href = 'patient-home.html'; }, 1200);
    }
  }, 1600);
}

// =====================================================
// STAFF LOGIN — Submit Handler
// =====================================================
function handleStaffSubmit(event) {
  event.preventDefault();
  if (isLoading) return;

  clearAlert();
  const clinicId = document.getElementById('clinic-select').value;
  const email = document.getElementById('staff-email').value.trim();
  const password = document.getElementById('staff-pass').value;

  // --- Validate ---
  if (!isValidEmail(email)) {
    return showAlert('error', '<i class="fa-solid fa-triangle-exclamation"></i> Please enter a valid staff email address.');
  }
  if (password.length < 1) {
    return showAlert('error', '<i class="fa-solid fa-triangle-exclamation"></i> Please enter your password.');
  }

  // --- Simulate API: POST /api/v1/auth/login ---
  setLoading(true, 'staff-primary-cta', 'staff-cta-text',
    selectedStaffSubrole === 'DOCTOR' ? 'Authenticating…' : 'Authenticating…');

  setTimeout(() => {
    const label = selectedStaffSubrole === 'DOCTOR' ? 'Sign In to Doctor Console' : 'Sign In to Reception Desk';
    setLoading(false, 'staff-primary-cta', 'staff-cta-text', label);

    const state = getCurrentSimState();

    if (state === 'error') {
      showAlert('error', '<i class="fa-solid fa-circle-xmark"></i> Invalid credentials or no staff record found for this clinic. Please check your details.');
    } else {
      showAlert('success', '<i class="fa-solid fa-circle-check"></i> Staff verified. Redirecting to your console…');
      localStorage.setItem('qureflow_token', 'simulated-jwt-staff-token');
      localStorage.setItem('qureflow_user', JSON.stringify({ role: selectedStaffSubrole, email, clinicId }));
      setTimeout(() => {
        if (selectedStaffSubrole === 'DOCTOR') {
          window.location.href = '6-doctor.html';
        } else {
          window.location.href = '5-reception.html';
        }
      }, 1200);
    }
  }, 1400);
}

// =====================================================
// SCREEN STATE SIMULATOR (QA/UX tool bar)
// =====================================================
let _simState = 'empty';

function getCurrentSimState() {
  return _simState;
}

function setScreenState(state) {
  _simState = state;
  const states = ['empty', 'loading', 'error', 'success'];
  states.forEach(s => {
    const btn = document.getElementById(`state-${s}-btn`);
    if (btn) btn.classList.toggle('active', s === state);
  });

  clearAlert();

  if (state === 'error') {
    showAlert('error', '<i class="fa-solid fa-triangle-exclamation"></i> Simulation: Invalid email/username or password.');
  } else if (state === 'success') {
    showAlert('success', '<i class="fa-solid fa-circle-check"></i> Simulation: Authentication successful. Redirecting…');
  }
}

// =====================================================
// ALERT SYSTEM
// =====================================================
function showAlert(type, message) {
  const alertBox = document.getElementById('alert-box');
  if (!alertBox) return;

  const colorMap = {
    error:   { bg: 'var(--color-error-bg)',   border: 'var(--color-error-border)',   text: '#B91C1C' },
    success: { bg: 'var(--color-success-bg)', border: 'var(--color-success-border)', text: '#047857' },
    warning: { bg: 'var(--color-warning-bg)', border: 'var(--color-warning-border)', text: '#B45309' },
  };

  const c = colorMap[type] || colorMap.error;
  alertBox.style.display = 'block';
  alertBox.style.cssText = `
    display: block;
    background: ${c.bg};
    border: 1px solid ${c.border};
    color: ${c.text};
    border-radius: var(--radius-unified);
    padding: 10px 14px;
    font-size: 13px;
    font-weight: 500;
    text-align: left;
    margin-bottom: var(--space-4);
    line-height: 1.5;
  `;
  alertBox.innerHTML = message;
}

function clearAlert() {
  const alertBox = document.getElementById('alert-box');
  if (alertBox) {
    alertBox.style.display = 'none';
    alertBox.innerHTML = '';
  }
}

// =====================================================
// LOADING STATE
// =====================================================
function setLoading(loading, btnId, textId, text) {
  isLoading = loading;
  const btn = document.getElementById(btnId);
  const textEl = document.getElementById(textId);
  if (!btn) return;

  btn.disabled = loading;
  if (textEl) textEl.textContent = text;

  // Add or remove spinner
  const existingSpinner = btn.querySelector('.spinner');
  if (loading && !existingSpinner) {
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    btn.insertBefore(spinner, btn.firstChild);
    // Remove icon temporarily
    const icon = btn.querySelector('i.fa-solid');
    if (icon) icon.style.display = 'none';
  } else if (!loading && existingSpinner) {
    existingSpinner.remove();
    const icon = btn.querySelector('i.fa-solid');
    if (icon) icon.style.display = '';
  }
}

// =====================================================
// INITIALIZE
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
  // Restore theme
  if (localStorage.getItem('qureflow-theme') === 'dark') {
    document.body.classList.add('dark-mode');
    document.documentElement.setAttribute('data-theme', 'dark');
    const btn = document.getElementById('theme-btn');
    if (btn) btn.innerHTML = '<i class="fa-solid fa-sun"></i> <span>Light Mode</span>';
  }

  // If already logged in, redirect
  const token = localStorage.getItem('qureflow_token');
  const userData = localStorage.getItem('qureflow_user');
  if (token && userData) {
    try {
      const user = JSON.parse(userData);
      if (user.role === 'PATIENT') window.location.href = 'patient-home.html';
      else if (user.role === 'DOCTOR') window.location.href = '6-doctor.html';
      else if (user.role === 'RECEPTIONIST') window.location.href = '5-reception.html';
    } catch(e) {
      localStorage.removeItem('qureflow_token');
      localStorage.removeItem('qureflow_user');
    }
  }
});
