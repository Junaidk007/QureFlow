import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  QrCode,
  Clock,
  Building2,
  Stethoscope,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import './CheckInPage.css';

export default function CheckInPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinCode, setPinCode] = useState('');

  // 1. Fetch upcoming appointment
  useEffect(() => {
    const fetchAppointment = async () => {
      try {
        setLoading(true);
        // Check if patient already has active visit
        const statusRes = await api.get('/visits/my-status');
        if (statusRes.data && statusRes.data.hasActiveVisit) {
          navigate('/queue');
          return;
        }

        const res = await api.get('/appointments/my-upcoming');
        if (res.data) {
          setAppointment(res.data);
        } else {
          setErrorMsg('No upcoming appointment found. Please book a slot first.');
        }
      } catch (err) {
        setErrorMsg('Failed to load appointment details.');
      } finally {
        setLoading(false);
      }
    };

    fetchAppointment();
  }, [navigate]);

  // Execute check-in
  const executeCheckIn = async (clinicId, appointmentId) => {
    setCheckingIn(true);
    setErrorMsg('');

    try {
      const res = await api.post('/visits/check-in', {
        clinicId,
        appointmentId,
      });

      setSuccessData(res.data);

      // Auto-navigate to Screen 05 (Queue Tracker) after 2 seconds
      setTimeout(() => {
        navigate('/queue');
      }, 2000);
    } catch (err) {
      setErrorMsg(err.message || 'Check-in validation failed.');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleSimulateScan = () => {
    if (!appointment) return;
    const clinicId = appointment.clinicId?._id || appointment.clinicId;
    executeCheckIn(clinicId, appointment._id);
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (!pinCode || pinCode.length < 4) {
      setErrorMsg('Please enter a valid 4 to 6 digit clinic arrival PIN.');
      return;
    }
    setShowPinModal(false);
    handleSimulateScan();
  };

  return (
    <div className="checkin-page-layout">
      {/* Header */}
      <header className="checkin-header">
        <button className="back-link" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={16} /> Dashboard
        </button>
        <div className="brand-name">Arrival QR Check-In</div>
        <div className="user-pill">{user?.name}</div>
      </header>

      {/* Main Viewport */}
      <main className="checkin-main-container">
        <motion.div
          className="checkin-card-wrapper"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {loading ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }}></div>
              <p className="text-muted">Loading appointment details...</p>
            </div>
          ) : appointment ? (
            <div>
              {/* Target Appointment Info Card */}
              <div className="card appt-info-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span className="badge badge-green">VERIFIED APPOINTMENT</span>
                  <span className="text-caption">Slot: {appointment.appointmentTime} hrs</span>
                </div>

                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div className="doctor-avatar-box">
                    <Stethoscope size={24} color="#17345C" />
                  </div>
                  <div>
                    <h2 className="text-h3" style={{ fontSize: 17 }}>
                      {appointment.doctorId?.name}
                    </h2>
                    <p className="text-muted" style={{ fontSize: 13 }}>
                      {appointment.doctorId?.specialization}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 12, color: 'var(--deep-winter-blue)' }}>
                      <Building2 size={13} /> {appointment.clinicId?.name}
                    </div>
                  </div>
                </div>

                <div className="checkin-window-alert" style={{ marginTop: 14 }}>
                  <Clock size={14} color="#17345C" />
                  <span>
                    Arrival Check-In: Active for today ({appointment.appointmentDate})
                  </span>
                </div>
              </div>

              {errorMsg && (
                <div className="auth-alert error" style={{ margin: '16px 0' }}>
                  <AlertCircle size={16} /> <span>{errorMsg}</span>
                </div>
              )}

              {/* Camera Scanner Viewfinder */}
              <div className="scanner-viewport">
                <div className="scanner-reticle">
                  {/* Corner accents */}
                  <div className="reticle-corner corner-tl"></div>
                  <div className="reticle-corner corner-tr"></div>
                  <div className="reticle-corner corner-bl"></div>
                  <div className="reticle-corner corner-br"></div>

                  {/* Animated laser beam */}
                  <div className="scanner-beam"></div>

                  <div className="reticle-center-icon">
                    <QrCode size={48} color="rgba(157, 183, 213, 0.4)" />
                  </div>
                </div>

                <div className="scanner-hint-text">
                  Align clinic arrival QR code within the frame
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  style={{ height: 48, fontSize: 15 }}
                  onClick={handleSimulateScan}
                  disabled={checkingIn}
                >
                  {checkingIn ? (
                    <div className="spinner"></div>
                  ) : (
                    <>
                      <Sparkles size={16} /> Scan Arrival QR Code
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="btn btn-outline btn-block"
                  onClick={() => setShowPinModal(true)}
                  disabled={checkingIn}
                >
                  <KeyRound size={15} /> Enter Clinic PIN Manually
                </button>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 32, textAlign: 'center' }}>
              <div className="empty-icon-circle" style={{ margin: '0 auto 16px' }}>
                <AlertCircle size={32} color="#EF4444" />
              </div>
              <h2 className="text-h2">No Active Booking</h2>
              <p className="text-muted" style={{ margin: '8px 0 20px' }}>
                You must have a scheduled appointment today to check in at the clinic.
              </p>
              <button className="btn btn-primary" onClick={() => navigate('/book')}>
                Book an Appointment
              </button>
            </div>
          )}
        </motion.div>
      </main>

      {/* Manual PIN Fallback Dialog */}
      <AnimatePresence>
        {showPinModal && (
          <div className="modal-backdrop">
            <motion.div
              className="card card-elevated modal-content"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <h2 className="text-h2" style={{ textAlign: 'center' }}>
                Manual Arrival Verification
              </h2>
              <p className="text-muted" style={{ textAlign: 'center', fontSize: 13, margin: '6px 0 20px' }}>
                Enter the 4–6 digit check-in code displayed on the clinic reception stand.
              </p>

              <form onSubmit={handlePinSubmit}>
                <div className="form-group">
                  <input
                    className="form-input"
                    style={{ textAlign: 'center', letterSpacing: '0.4em', fontSize: 24, fontWeight: 700 }}
                    maxLength={6}
                    placeholder="••••••"
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    autoFocus
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ flex: 1 }}
                    onClick={() => setShowPinModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                    Verify &amp; Check In
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      <AnimatePresence>
        {successData && (
          <div className="modal-backdrop">
            <motion.div
              className="card card-elevated modal-content"
              style={{ textAlign: 'center' }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <div className="success-icon-circle">
                <CheckCircle2 size={40} color="#10B981" />
              </div>

              <span className="badge badge-green" style={{ margin: '14px 0 8px' }}>
                ARRIVAL CONFIRMED
              </span>

              <div className="display-hero" style={{ color: 'var(--deep-winter-blue)', fontSize: 44, margin: '4px 0' }}>
                Token #{successData.tokenId}
              </div>

              <p className="text-muted" style={{ fontSize: 13 }}>
                You are now active in the doctor's queue.
              </p>

              <div className="token-meta-box" style={{ margin: '20px 0', padding: 14, backgroundColor: 'var(--muted)', borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span className="text-muted">Estimated Wait:</span>
                  <strong>{successData.eta?.formattedRange || '0–10 mins'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-muted">Patients Ahead:</span>
                  <strong>{successData.eta?.patientsAhead || 0}</strong>
                </div>
              </div>

              <p style={{ fontSize: 12, color: 'var(--slate-frost)' }}>
                Redirecting to Live Queue Tracker...
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
