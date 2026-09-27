import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Stethoscope,
  Clock,
  HeartPulse,
  Droplet,
  Weight,
  ClipboardList,
  FastForward,
  UserCheck,
  AlertTriangle,
  Coffee,
  LogOut,
  Users,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import useWebSocket from '../../hooks/useWebSocket';
import './DoctorPage.css';

export default function DoctorPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeVisit, setActiveVisit] = useState(null);
  const [upNext, setUpNext] = useState([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [doctorStatus, setDoctorStatus] = useState('AVAILABLE');
  const [breakUntil, setBreakUntil] = useState(null);

  // Vitals & Notes Form
  const [bp, setBp] = useState('120/80');
  const [sugar, setSugar] = useState('98');
  const [weight, setWeight] = useState('70');
  const [notes, setNotes] = useState('');

  // Alert Banners
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Elapsed Consultation Timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef(null);

  // Fetch Doctor's Live Queue
  const fetchQueue = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await api.get('/visits/my-queue');
      const data = res.data;
      setActiveVisit(data.activeVisit || null);
      setUpNext(data.upNext || []);
      setCompletedCount(data.completedCount || 0);
      setDoctorStatus(data.doctorStatus || 'AVAILABLE');
      setBreakUntil(data.breakUntil || null);

      if (data.activeVisit) {
        // Compute elapsed time from consult start
        const start = new Date(data.activeVisit.consultStartedAt || data.activeVisit.checkedInAt).getTime();
        const diff = Math.max(0, Math.floor((Date.now() - start) / 1000));
        setElapsedSeconds(diff);
      } else {
        setElapsedSeconds(0);
      }
    } catch (err) {
      console.error('Failed to fetch doctor queue:', err);
      setErrorMsg(err.message || 'Failed to load consultation queue');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  // Timer runner
  useEffect(() => {
    if (activeVisit) {
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      setElapsedSeconds(0);
    }
    return () => clearInterval(timerRef.current);
  }, [activeVisit]);

  // Initial Load
  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // WebSocket Subscription
  const rooms = user ? [`doctor:${user._id}`, `clinic:${user.clinicId}`] : [];
  const handleWsEvent = useCallback(
    (event, payload) => {
      console.log('[Doctor WS Event]', event, payload);
      if (event === 'QUEUE_UPDATED' || event === 'VISIT_CALLED') {
        fetchQueue(true);
      }
      if (event === 'DOCTOR_STATUS_CHANGED') {
        if (payload.status) setDoctorStatus(payload.status);
        if (payload.breakUntil) setBreakUntil(payload.breakUntil);
      }
    },
    [fetchQueue]
  );
  useWebSocket(rooms, handleWsEvent);

  // Format Timer mm:ss
  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Start Consultation (Call Patient)
  const handleStartConsult = async (visitId) => {
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await api.put(`/visits/${visitId}/start`);
      setSuccessMsg(`Patient with Token #${res.data.tokenId} called into cabin.`);
      setBp('120/80');
      setSugar('98');
      setWeight('70');
      setNotes('');
      await fetchQueue(true);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to start consultation');
    } finally {
      setActionLoading(false);
    }
  };

  // Complete Consultation & Record Vitals
  const handleCompleteConsult = async () => {
    if (!activeVisit) return;
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const vitalsPayload = {
        vitals: {
          bp: bp.trim() || null,
          sugar: sugar ? Number(sugar) : null,
          weight: weight ? Number(weight) : null,
        },
        notes: notes.trim() || '',
      };

      const res = await api.put(`/visits/${activeVisit._id}/complete`, vitalsPayload);
      const finishedToken = res.data.tokenId;

      // Check if another patient is next in line
      if (upNext.length > 0) {
        const nextPatient = upNext[0];
        setSuccessMsg(`Completed Token #${finishedToken}. Calling next patient #${nextPatient.tokenId}...`);
        // Immediately start next patient
        await api.put(`/visits/${nextPatient._id}/start`);
        setBp('120/80');
        setSugar('98');
        setWeight('70');
        setNotes('');
      } else {
        setSuccessMsg(`Completed consultation for Token #${finishedToken}. Queue is clear!`);
      }

      await fetchQueue(true);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to complete consultation');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Break Status
  const handleToggleBreak = async () => {
    setActionLoading(true);
    try {
      const nextStatus = doctorStatus === 'AVAILABLE' ? 'ON_BREAK' : 'AVAILABLE';
      const res = await api.put('/doctors/status', {
        status: nextStatus,
        breakMinutes: 15,
      });
      setDoctorStatus(res.data.status);
      setBreakUntil(res.data.breakUntil);
      setSuccessMsg(
        nextStatus === 'ON_BREAK'
          ? 'Break mode active (15 mins broadcasted to reception and waiting patients)'
          : 'Consultations resumed. Doctor is available.'
      );
    } catch (err) {
      setErrorMsg(err.message || 'Failed to toggle break status');
    } finally {
      setActionLoading(false);
    }
  };

  // Sign out
  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  return (
    <div className="doctor-page-container">
      {/* Header */}
      <header className="doctor-header">
        <div className="doctor-brand">
          <div className="doctor-logo-icon">Q</div>
          <div>
            <strong style="font-family: var(--font-heading); font-size: 17px; display: block;">QureFlow</strong>
            <span style={{ fontSize: 11, color: 'var(--color-accent-muted)', fontWeight: 500 }}>
              Doctor Clinical Desk
            </span>
          </div>
        </div>

        <div className="doctor-header-actions">
          <div className={`doctor-badge-status ${doctorStatus === 'ON_BREAK' ? 'on-break' : ''}`}>
            <Stethoscope size={15} />
            <span>
              {user?.name} • Cabin 02
              {doctorStatus === 'ON_BREAK' && ' (On Break)'}
            </span>
          </div>

          <button
            className={`btn btn-secondary ${doctorStatus === 'ON_BREAK' ? 'btn-primary' : ''}`}
            style={{ height: 34, padding: '0 12px', fontSize: 13, gap: 6 }}
            onClick={handleToggleBreak}
            disabled={actionLoading}
            title={doctorStatus === 'AVAILABLE' ? 'Take a 15-minute break' : 'Resume consultations'}
          >
            <Coffee size={14} />
            <span>{doctorStatus === 'AVAILABLE' ? 'Take Break' : 'Resume'}</span>
          </button>

          <button
            className="btn btn-secondary"
            style={{ height: 34, padding: '0 12px', fontSize: 13 }}
            onClick={handleLogout}
            title="Sign Out"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="doctor-layout">
        {/* Banner Messages */}
        <div style={{ gridColumn: '1 / -1' }}>
          <AnimatePresence>
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{
                  background: '#FEE2E2',
                  border: '1px solid #FCA5A5',
                  color: '#991B1B',
                  padding: '10px 16px',
                  borderRadius: 8,
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 13,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={16} />
                  <span>{errorMsg}</span>
                </div>
                <button
                  onClick={() => setErrorMsg(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991B1B', fontWeight: 700 }}
                >
                  ✕
                </button>
              </motion.div>
            )}

            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{
                  background: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  color: '#065F46',
                  padding: '10px 16px',
                  borderRadius: 8,
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 13,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={16} />
                  <span>{successMsg}</span>
                </div>
                <button
                  onClick={() => setSuccessMsg(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065F46', fontWeight: 700 }}
                >
                  ✕
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* LEFT COLUMN: Active Encounter or Idle State */}
        <section>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <RefreshCw size={24} className="spin" color="var(--deep-winter-blue)" />
              <p style={{ marginTop: 12, color: 'var(--color-accent-muted)' }}>Loading consultation desk...</p>
            </div>
          ) : activeVisit ? (
            <>
              {/* Active Encounter Hero */}
              <div className="encounter-card">
                <div className="encounter-header">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span className="badge badge-green">
                        <CheckCircle2 size={13} /> IN CONSULTATION (CHECK_UP)
                      </span>
                      {activeVisit.isUrgent && (
                        <span className="badge badge-red">
                          <AlertTriangle size={12} /> URGENT TRIAGE
                        </span>
                      )}
                      <span
                        className="badge"
                        style={{
                          background: 'var(--frost-mist)',
                          color: 'var(--deep-winter-blue)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        {activeVisit.appointmentId ? 'Booked Visit' : 'Walk-in'}
                      </span>
                    </div>

                    <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px', color: 'var(--color-accent-black)' }}>
                      {activeVisit.patientId?.name || 'Walk-In Patient'}
                    </h1>
                    <p style={{ fontSize: 13, color: 'var(--color-accent-muted)', margin: 0 }}>
                      ID: #{activeVisit.patientId?._id?.slice(-6) || 'WALKIN'} • Phone:{' '}
                      {activeVisit.patientId?.phone || 'N/A'} • Visit Date: {activeVisit.visitDate}
                    </p>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--color-accent-muted)', fontWeight: 600, marginBottom: 2 }}>
                      TOKEN NUMBER
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: 36,
                        fontWeight: 800,
                        color: 'var(--deep-winter-blue)',
                        lineHeight: 1,
                      }}
                    >
                      #{activeVisit.tokenId}
                    </div>
                    <div
                      className={`timer-badge ${elapsedSeconds > 1200 ? 'warning' : ''}`}
                      style={{ marginTop: 8 }}
                      title="Live consultation elapsed duration"
                    >
                      <Clock size={14} />
                      <span>{formatTimer(elapsedSeconds)}</span>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--frost-mist)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 12,
                    color: 'var(--color-accent-muted)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  Arrival: {new Date(activeVisit.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                  {activeVisit.appointmentId?.appointmentTime ? `Scheduled: ${activeVisit.appointmentId.appointmentTime}` : 'Walk-in arrival'}
                </div>
              </div>

              {/* Quick Vitals Recording Card */}
              <div className="vitals-card">
                <h3
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    margin: '0 0 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <HeartPulse size={16} color="var(--color-error)" /> Clinical Vitals & Measurements
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--deep-winter-blue)', fontWeight: 500 }}>
                    Recorded into Visits.vitals
                  </span>
                </h3>

                <div className="vitals-grid">
                  {/* Blood Pressure */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" htmlFor="vit-bp" style={{ fontSize: 12, marginBottom: 4 }}>
                      Blood Pressure
                    </label>
                    <div className="vital-input-wrapper">
                      <input
                        type="text"
                        id="vit-bp"
                        className="form-input"
                        placeholder="120/80"
                        value={bp}
                        onChange={(e) => setBp(e.target.value)}
                        disabled={actionLoading}
                      />
                      <span className="vital-unit-addon">mmHg</span>
                    </div>
                  </div>

                  {/* Blood Sugar */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" htmlFor="vit-sugar" style={{ fontSize: 12, marginBottom: 4 }}>
                      Blood Sugar
                    </label>
                    <div className="vital-input-wrapper">
                      <input
                        type="number"
                        id="vit-sugar"
                        className="form-input"
                        placeholder="100"
                        value={sugar}
                        onChange={(e) => setSugar(e.target.value)}
                        disabled={actionLoading}
                      />
                      <span className="vital-unit-addon">mg/dL</span>
                    </div>
                  </div>

                  {/* Body Weight */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" htmlFor="vit-weight" style={{ fontSize: 12, marginBottom: 4 }}>
                      Body Weight
                    </label>
                    <div className="vital-input-wrapper">
                      <input
                        type="number"
                        step="0.1"
                        id="vit-weight"
                        className="form-input"
                        placeholder="70.0"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        disabled={actionLoading}
                      />
                      <span className="vital-unit-addon">kg</span>
                    </div>
                  </div>
                </div>

                {/* Clinical Notes Field */}
                <div className="form-group" style={{ marginTop: 16, marginBottom: 20 }}>
                  <label className="form-label" htmlFor="vit-notes" style={{ fontSize: 12, marginBottom: 4 }}>
                    <ClipboardList size={13} style={{ display: 'inline', marginRight: 4 }} />
                    Consultation Notes / Diagnosis
                  </label>
                  <textarea
                    id="vit-notes"
                    className="form-input"
                    style={{ height: 76, padding: '10px 12px', resize: 'none', fontSize: 13 }}
                    placeholder="Enter diagnosis, prescription summary or recommendations..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={actionLoading}
                  />
                </div>

                {/* Primary Complete CTA */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="btn btn-primary btn-block"
                  style={{ height: 48, fontSize: 15, fontWeight: 700 }}
                  onClick={handleCompleteConsult}
                  disabled={actionLoading}
                >
                  <FastForward size={18} />
                  <span>
                    {actionLoading
                      ? 'Saving vitals & advancing queue...'
                      : upNext.length > 0
                      ? `Complete Consult & Call Next (#${upNext[0].tokenId}) →`
                      : 'Complete Consultation & Clear →'}
                  </span>
                </motion.button>
              </div>
            </>
          ) : upNext.length > 0 ? (
            /* Idle but Patients Waiting */
            <div className="encounter-card idle" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'var(--frost-mist)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  color: 'var(--deep-winter-blue)',
                }}
              >
                <Users size={28} />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>Ready for Next Consultation</h2>
              <p style={{ color: 'var(--color-accent-muted)', fontSize: 14, maxWidth: 440, margin: '0 auto 24px' }}>
                There are <strong>{upNext.length}</strong> patient(s) waiting in your queue. Call the next patient to
                begin.
              </p>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn btn-primary"
                style={{ height: 46, padding: '0 28px', fontSize: 15, margin: '0 auto' }}
                onClick={() => handleStartConsult(upNext[0]._id)}
                disabled={actionLoading}
              >
                <FastForward size={18} />
                <span>Call Next Patient (#{upNext[0].tokenId}) →</span>
              </motion.button>
            </div>
          ) : (
            /* Queue Completely Clear */
            <div className="empty-doctor-view">
              <div style={{ color: 'var(--color-success)', marginBottom: 12 }}>
                <CheckCircle2 size={48} style={{ margin: '0 auto' }} />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>Queue is Completely Clear!</h2>
              <p style={{ color: 'var(--color-accent-muted)', fontSize: 14, maxWidth: 440, margin: '0 auto 20px' }}>
                All scheduled and walk-in patients for today's OPD have been seen. New check-ins at reception will alert
                you automatically.
              </p>
              <div className="badge badge-green" style={{ height: 28, fontSize: 13, margin: '0 auto' }}>
                Total Patients Seen Today: {completedCount}
              </div>
            </div>
          )}
        </section>

        {/* RIGHT COLUMN: Up-Next Queue Preview */}
        <aside>
          <div className="upnext-card">
            <h3
              style={{
                fontSize: 15,
                fontWeight: 700,
                margin: '0 0 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={16} /> Up Next in Line
              </span>
              <span className="badge badge-blue">{upNext.length} Waiting</span>
            </h3>

            {upNext.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-accent-muted)', fontSize: 13 }}>
                No patients waiting in queue.
              </div>
            ) : (
              <div>
                {upNext.map((item) => (
                  <div
                    key={item._id}
                    className={`upnext-item ${item.isUrgent ? 'urgent' : ''}`}
                    onClick={() => {
                      if (!activeVisit && !actionLoading) {
                        handleStartConsult(item._id);
                      }
                    }}
                    style={{ cursor: !activeVisit ? 'pointer' : 'default' }}
                    title={!activeVisit ? 'Click to call patient now' : undefined}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 14,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          color: item.isUrgent ? '#B45309' : 'inherit',
                        }}
                      >
                        {item.isUrgent && <AlertTriangle size={13} color="#B45309" />}
                        <span>{item.patientId?.name || 'Walk-in Patient'}</span>
                      </div>
                      <div style={{ fontSize: 12, color: item.isUrgent ? '#B45309' : 'var(--color-accent-muted)' }}>
                        {item.isUrgent
                          ? 'Urgent Walk-in'
                          : item.appointmentId
                          ? `Booked • ${item.appointmentId.appointmentTime}`
                          : 'Walk-in'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className={`token-chip ${item.isUrgent ? 'urgent-chip' : ''}`}>
                        #{item.tokenId}
                      </span>
                      {!activeVisit && (
                        <ChevronRight size={16} color="var(--color-accent-muted)" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div
              style={{
                marginTop: 16,
                paddingTop: 12,
                borderTop: '1px solid var(--color-border)',
                fontSize: 12,
                color: 'var(--color-accent-muted)',
                lineHeight: 1.4,
              }}
            >
              Completing this visit moves patient to <code>DONE</code>, recalculates dynamic ETAs, and triggers real-time
              WebSocket updates for all waiting patients.
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
