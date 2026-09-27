import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  User as UserIcon,
  ShieldCheck,
  Eye,
  EyeOff,
  Stethoscope,
  ClipboardList,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import './AuthPage.css';

export default function AuthPage() {
  const navigate = useNavigate();
  const { login, register, isAuthenticated, user } = useAuth();

  // Top level role: 'patient' | 'staff'
  const [role, setRole] = useState('patient');
  // Patient submode: 'login' | 'register'
  const [patientMode, setPatientMode] = useState('login');
  // Staff subrole: 'DOCTOR' | 'RECEPTIONIST'
  const [staffRole, setStaffRole] = useState('DOCTOR');

  // Clinics for staff dropdown
  const [clinics, setClinics] = useState([]);
  const [selectedClinicId, setSelectedClinicId] = useState('');

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);

  // Form states
  const [patientLoginForm, setPatientLoginForm] = useState({ identifier: '', password: '' });
  const [patientRegForm, setPatientRegForm] = useState({ name: '', username: '', email: '', password: '' });
  const [staffLoginForm, setStaffLoginForm] = useState({ email: '', password: '' });

  // Status states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'PATIENT') navigate('/dashboard');
      else if (user.role === 'DOCTOR') navigate('/doctor');
      else if (user.role === 'RECEPTIONIST') navigate('/reception');
    }
  }, [isAuthenticated, user, navigate]);

  // Load clinics for staff login
  useEffect(() => {
    const loadClinics = async () => {
      try {
        const res = await api.get('/clinics');
        if (res.data && res.data.length > 0) {
          setClinics(res.data);
          setSelectedClinicId(res.data[0]._id);
        }
      } catch (err) {
        console.error('Failed to load clinics:', err);
      }
    };
    loadClinics();
  }, []);

  // Compute password strength
  const computePasswordStrength = (pass) => {
    if (!pass) return { score: 0, text: '', class: '' };
    if (pass.length < 6) return { score: 33, text: 'Weak — At least 6 characters required', class: 'weak' };
    const hasLetters = /[a-zA-Z]/.test(pass);
    const hasNumbers = /[0-9]/.test(pass);
    const hasSpecial = /[^a-zA-Z0-9]/.test(pass);
    if (pass.length >= 8 && hasLetters && hasNumbers && hasSpecial) {
      return { score: 100, text: 'Strong password', class: 'strong' };
    }
    return { score: 66, text: 'Fair — Add numbers or symbols to strengthen', class: 'fair' };
  };

  const strength = computePasswordStrength(patientRegForm.password);

  // Handle Patient Login
  const handlePatientLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const loggedUser = await login({
        identifier: patientLoginForm.identifier,
        password: patientLoginForm.password,
      });
      navigate('/dashboard');
    } catch (err) {
      setErrorMsg(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Patient Register
  const handlePatientRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (patientRegForm.password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      await register({
        name: patientRegForm.name,
        username: patientRegForm.username,
        email: patientRegForm.email,
        password: patientRegForm.password,
      });
      setSuccessMsg('Account created successfully! Redirecting...');
      setTimeout(() => navigate('/dashboard'), 600);
    } catch (err) {
      setErrorMsg(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Staff Login
  const handleStaffLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedClinicId) {
      setErrorMsg('Please select a clinic to sign in.');
      return;
    }

    setLoading(true);

    try {
      const loggedUser = await login({
        identifier: staffLoginForm.email,
        password: staffLoginForm.password,
        clinicId: selectedClinicId,
        role: staffRole,
      });

      if (loggedUser.role === 'DOCTOR') navigate('/doctor');
      else navigate('/reception');
    } catch (err) {
      setErrorMsg(err.message || 'Staff authentication failed. Please verify clinic and credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card-wrapper">
        {/* Brand Header */}
        <header className="brand-header">
          <div className="brand-badge">
            <Activity size={14} color="#17345C" /> Real-Time Clinic Flow
          </div>
          <div className="brand-logo">
            <div className="brand-logo-icon">Q</div>
            <span>QureFlow</span>
          </div>
          <p className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>
            Seamless Queueing & Clinical Practice Management
          </p>
        </header>

        {/* Global Error/Success Alert Banners */}
        {errorMsg && (
          <motion.div
            className="auth-alert error"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </motion.div>
        )}

        {successMsg && (
          <motion.div
            className="auth-alert success"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </motion.div>
        )}

        {/* Role Segmented Switcher */}
        <div className="role-segmented-control">
          <button
            type="button"
            className={`role-segment-btn ${role === 'patient' ? 'active' : ''}`}
            onClick={() => {
              setRole('patient');
              setErrorMsg('');
            }}
          >
            <UserIcon size={16} /> Patient Portal
          </button>
          <button
            type="button"
            className={`role-segment-btn ${role === 'staff' ? 'active' : ''}`}
            onClick={() => {
              setRole('staff');
              setErrorMsg('');
            }}
          >
            <ShieldCheck size={16} /> Clinic Staff
          </button>
        </div>

        {/* Main Card */}
        <div className="card card-elevated" style={{ textAlign: 'left', padding: 24 }}>
          {role === 'patient' ? (
            <div>
              {/* Patient Submode Tabs (Login vs Register) */}
              <div className="auth-mode-tabs">
                <button
                  type="button"
                  className={`auth-mode-tab ${patientMode === 'login' ? 'active' : ''}`}
                  onClick={() => {
                    setPatientMode('login');
                    setErrorMsg('');
                  }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className={`auth-mode-tab ${patientMode === 'register' ? 'active' : ''}`}
                  onClick={() => {
                    setPatientMode('register');
                    setErrorMsg('');
                  }}
                >
                  Create Account
                </button>
              </div>

              <AnimatePresence mode="wait">
                {patientMode === 'login' ? (
                  <motion.form
                    key="patient-login"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                    onSubmit={handlePatientLogin}
                  >
                    <div className="form-group">
                      <label className="form-label">Email or Username</label>
                      <input
                        className="form-input"
                        type="text"
                        placeholder="john_doe or patient@example.com"
                        value={patientLoginForm.identifier}
                        onChange={(e) => setPatientLoginForm({ ...patientLoginForm, identifier: e.target.value })}
                        required
                        disabled={loading}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Password</label>
                      <div className="password-input-wrapper">
                        <input
                          className="form-input"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={patientLoginForm.password}
                          onChange={(e) => setPatientLoginForm({ ...patientLoginForm, password: e.target.value })}
                          required
                          disabled={loading}
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label="Toggle password visibility"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary btn-block"
                      style={{ marginTop: 8 }}
                      disabled={loading || !patientLoginForm.identifier || !patientLoginForm.password}
                    >
                      {loading ? (
                        <div className="spinner"></div>
                      ) : (
                        <>
                          Sign In to Queue <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  </motion.form>
                ) : (
                  <motion.form
                    key="patient-register"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                    onSubmit={handlePatientRegister}
                  >
                    <div className="form-group">
                      <label className="form-label">Full Name</label>
                      <input
                        className="form-input"
                        type="text"
                        placeholder="Jane Doe"
                        value={patientRegForm.name}
                        onChange={(e) => setPatientRegForm({ ...patientRegForm, name: e.target.value })}
                        required
                        disabled={loading}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Username</label>
                      <input
                        className="form-input"
                        type="text"
                        placeholder="janedoe99"
                        value={patientRegForm.username}
                        onChange={(e) => setPatientRegForm({ ...patientRegForm, username: e.target.value })}
                        required
                        disabled={loading}
                      />
                      <span className="field-helper">Alphanumeric characters and underscores only</span>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Email Address</label>
                      <input
                        className="form-input"
                        type="email"
                        placeholder="jane@example.com"
                        value={patientRegForm.email}
                        onChange={(e) => setPatientRegForm({ ...patientRegForm, email: e.target.value })}
                        required
                        disabled={loading}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Create Password</label>
                      <div className="password-input-wrapper">
                        <input
                          className="form-input"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="At least 6 characters"
                          value={patientRegForm.password}
                          onChange={(e) => setPatientRegForm({ ...patientRegForm, password: e.target.value })}
                          required
                          disabled={loading}
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label="Toggle password visibility"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>

                      {/* 3-Tier Password Strength Bar */}
                      {patientRegForm.password && (
                        <div className="password-strength">
                          <div className="strength-bar">
                            <div className={`strength-fill ${strength.class}`}></div>
                          </div>
                          <span className={`strength-label ${strength.class}`}>{strength.text}</span>
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary btn-block"
                      style={{ marginTop: 8 }}
                      disabled={
                        loading ||
                        !patientRegForm.name ||
                        !patientRegForm.username ||
                        !patientRegForm.email ||
                        patientRegForm.password.length < 6
                      }
                    >
                      {loading ? (
                        <div className="spinner"></div>
                      ) : (
                        <>
                          Create Patient Account <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          ) : (
            /* Staff Mode */
            <motion.form
              key="staff-login"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleStaffLogin}
            >
              <div className="form-group">
                <label className="form-label">Clinic Facility</label>
                <select
                  className="form-input"
                  value={selectedClinicId}
                  onChange={(e) => setSelectedClinicId(e.target.value)}
                  disabled={loading}
                >
                  {clinics.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subrole Pills: Doctor vs Receptionist */}
              <div className="form-group">
                <label className="form-label">Role Console</label>
                <div className="staff-subrole-selector">
                  <button
                    type="button"
                    className={`subrole-pill ${staffRole === 'DOCTOR' ? 'active' : ''}`}
                    onClick={() => setStaffRole('DOCTOR')}
                  >
                    <Stethoscope size={16} /> Doctor Desk
                  </button>
                  <button
                    type="button"
                    className={`subrole-pill ${staffRole === 'RECEPTIONIST' ? 'active' : ''}`}
                    onClick={() => setStaffRole('RECEPTIONIST')}
                  >
                    <ClipboardList size={16} /> Reception Console
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Staff Work Email</label>
                <input
                  className="form-input"
                  type="email"
                  placeholder={staffRole === 'DOCTOR' ? 'doctor@qureflow.com' : 'reception@qureflow.com'}
                  value={staffLoginForm.email}
                  onChange={(e) => setStaffLoginForm({ ...staffLoginForm, email: e.target.value })}
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <div className="password-input-wrapper">
                  <input
                    className="form-input"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={staffLoginForm.password}
                    onChange={(e) => setStaffLoginForm({ ...staffLoginForm, password: e.target.value })}
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block"
                style={{ marginTop: 8 }}
                disabled={loading || !staffLoginForm.email || !staffLoginForm.password}
              >
                {loading ? (
                  <div className="spinner"></div>
                ) : (
                  <>
                    <Lock size={15} /> Sign In to {staffRole === 'DOCTOR' ? 'Doctor Desk' : 'Reception'}
                  </>
                )}
              </button>
            </motion.form>
          )}
        </div>

        {/* Footer info */}
        <footer className="auth-footer">
          <p>
            QureFlow Clinical HIPAA-Ready Queue Engine. <br />
            Protected by Arctic Frost Session Security.
          </p>
        </footer>
      </div>
    </div>
  );
}
