import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Calendar,
  QrCode,
  Users,
  Clock,
  ArrowRight,
  LogOut,
  Stethoscope,
  Building2,
  FileText,
  AlertCircle,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Check,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import PatientHeader from '../../components/PatientHeader/PatientHeader';
import BottomNav from '../../components/BottomNav/BottomNav';
import './PatientHomePage.css';

export default function PatientHomePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [activeVisitData, setActiveVisitData] = useState(null);
  const [upcomingAppointment, setUpcomingAppointment] = useState(null);
  const [allAppointments, setAllAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);

  // Filter state for all appointments
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Cancel Modal state
  const [appointmentToCancel, setAppointmentToCancel] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelFeedback, setCancelFeedback] = useState('');

  // Load patient dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      // 1. Check for active visit in queue today
      const statusRes = await api.get('/visits/my-status');
      if (statusRes.data && statusRes.data.hasActiveVisit) {
        setActiveVisitData(statusRes.data);
      } else {
        setActiveVisitData(null);
      }

      // 2. Fetch upcoming booked appointment
      const apptRes = await api.get('/appointments/my-upcoming');
      if (apptRes.data) {
        setUpcomingAppointment(apptRes.data);
      } else {
        setUpcomingAppointment(null);
      }

      // 3. Fetch all appointments
      const allApptsRes = await api.get('/appointments/my-appointments');
      if (allApptsRes.data) {
        setAllAppointments(allApptsRes.data);
      }

      // 4. Fetch active specialists on duty
      const docRes = await api.get('/doctors/active');
      if (docRes.data) {
        setDoctors(docRes.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Handle appointment cancellation
  const handleConfirmCancel = async () => {
    if (!appointmentToCancel) return;
    setCancelling(true);
    setCancelFeedback('');

    try {
      await api.put(`/appointments/${appointmentToCancel._id}/cancel`);
      setCancelFeedback('Appointment successfully cancelled.');
      setAppointmentToCancel(null);
      await fetchDashboardData();
      setTimeout(() => setCancelFeedback(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to cancel appointment.');
    } finally {
      setCancelling(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const isApptToday = upcomingAppointment && upcomingAppointment.appointmentDate === todayStr;

  // Filtered appointments list
  const filteredAppointments = allAppointments.filter((appt) => {
    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'BOOKED') return appt.status === 'BOOKED';
    if (filterStatus === 'CANCELLED') return appt.status === 'CANCELLED';
    if (filterStatus === 'COMPLETED') return appt.visit?.status === 'DONE';
    return true;
  });

  return (
    <div className="patient-home-layout">
      {/* Top Application Header: Profile on Top-Left & Logout on Top-Right on mobile */}
      <PatientHeader title="QureFlow" subtitle="Patient Portal" />

      {/* Main Dashboard Container */}
      <main className="home-content">
        {/* Welcome Section */}
        <section className="welcome-banner">
          <div>
            <h1 className="text-h1">Welcome back, {user?.name?.split(' ')[0] || 'Patient'}</h1>
            <p className="text-muted">Here is your live clinic visit and appointment overview.</p>
          </div>
          <div className="clinic-location-badge">
            <Building2 size={15} /> City Central Health Clinic
          </div>
        </section>

        {cancelFeedback && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius)',
              background: '#ECFDF5',
              border: '1px solid #A7F3D0',
              color: '#065F46',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <CheckCircle2 size={18} color="#059669" />
            <span>{cancelFeedback}</span>
          </div>
        )}

        {/* Dynamic Hero Context Card */}
        <section className="hero-context-section">
          {loading ? (
            <div className="card hero-context-card" style={{ padding: 32, textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }}></div>
              <p className="text-muted">Syncing with Clinic Queue Engine...</p>
            </div>
          ) : activeVisitData ? (
            /* State A: Currently In Queue */
            <motion.div
              className="card hero-context-card state-queue"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="context-card-header">
                <div>
                  <span className="badge badge-blue">LIVE VISIT IN PROGRESS</span>
                  <div className="display-hero token-display" style={{ marginTop: 6, color: 'var(--deep-winter-blue)' }}>
                    Token #{activeVisitData.visit.tokenId}
                  </div>
                </div>

                <div className="eta-badge-group">
                  <div className="badge badge-amber" style={{ fontSize: 13, height: 28 }}>
                    <Clock size={14} /> Estimated Wait: {activeVisitData.eta.formattedRange}
                  </div>
                  <div className="text-caption" style={{ marginTop: 4 }}>
                    {activeVisitData.eta.patientsAhead} Patients Ahead of You
                  </div>
                </div>
              </div>

              <div className="context-card-body">
                <p>
                  Assigned Specialist: <strong>{activeVisitData.visit.doctorId?.name}</strong> (
                  {activeVisitData.visit.doctorId?.specialization})
                </p>
                <p className="text-muted" style={{ fontSize: 13 }}>
                  Status: <strong>{activeVisitData.visit.status}</strong> · Please stay within the clinic waiting area.
                </p>
              </div>

              <div className="context-card-footer">
                <button className="btn btn-primary" onClick={() => navigate('/queue')}>
                  Track Live Queue <ArrowRight size={15} />
                </button>
              </div>
            </motion.div>
          ) : isApptToday ? (
            /* State B: Booked Appointment Today */
            <motion.div
              className="card hero-context-card state-appt"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="context-card-header">
                <div>
                  <span className="badge badge-green">APPOINTMENT TODAY</span>
                  <h2 className="text-h2" style={{ marginTop: 6 }}>
                    {upcomingAppointment.doctorId?.name} ({upcomingAppointment.doctorId?.specialization})
                  </h2>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="badge badge-amber" style={{ fontSize: 13, height: 28 }}>
                    <Clock size={14} /> Check-In: {upcomingAppointment.checkInWindow?.startTime || '09:00'} – {upcomingAppointment.checkInWindow?.endTime || '12:00'}
                  </span>
                  <div className="badge badge-blue">
                    {upcomingAppointment.type === 'NEW' ? 'New Consultation' : 'Follow-up'}
                  </div>
                </div>
              </div>

              <div className="context-card-body">
                <p className="text-muted">
                  Clinic Facility: {upcomingAppointment.clinicId?.name} · Date: <strong>{upcomingAppointment.appointmentDate}</strong>
                </p>

                {/* Check-In Mandatory Warning Notice */}
                <div
                  style={{
                    marginTop: 12,
                    padding: '10px 14px',
                    borderRadius: 'var(--radius)',
                    background: '#FFFBEB',
                    border: '1px solid #FCD34D',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <AlertTriangle size={18} color="#D97706" style={{ flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: 12.5, color: '#92400E', fontWeight: 500, lineHeight: 1.45 }}>
                    <strong>Mandatory Check-In:</strong> You have to check in between <strong>{upcomingAppointment.checkInWindow?.startTime || '09:00'}</strong> and <strong>{upcomingAppointment.checkInWindow?.endTime || '12:00'}</strong>, else your appointment will be invalid.
                  </p>
                </div>
              </div>

              <div className="context-card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <button className="btn btn-primary" onClick={() => navigate('/checkin')}>
                  <QrCode size={16} /> Scan QR to Check In <ArrowRight size={15} />
                </button>
                <button
                  className="btn-cancel-appt"
                  onClick={() => setAppointmentToCancel(upcomingAppointment)}
                >
                  <XCircle size={15} /> Cancel Appointment
                </button>
              </div>
            </motion.div>
          ) : (
            /* State C: No Appointment Today */
            <motion.div
              className="card hero-context-card state-empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="empty-context-content">
                <div className="empty-icon-circle">
                  <Calendar size={28} color="#17345C" />
                </div>
                <div>
                  <h2 className="text-h2">No Appointments Scheduled Today</h2>
                  <p className="text-muted" style={{ maxWidth: 460, marginTop: 4 }}>
                    Reserve your consultation with a doctor in advance to secure your place in the clinic OPD.
                  </p>
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <button className="btn btn-primary" onClick={() => navigate('/book')}>
                  Book an Appointment <ArrowRight size={15} />
                </button>
              </div>
            </motion.div>
          )}
        </section>

        {/* 4-Tile Quick Action Grid */}
        <section className="quick-actions-section">
          <h2 className="text-h3" style={{ marginBottom: 12 }}>
            Quick Actions
          </h2>
          <div className="action-grid">
            <button className="action-card" onClick={() => navigate('/book')}>
              <div className="action-card-icon">
                <Calendar size={22} />
              </div>
              <span className="action-title">Book Doctor</span>
              <span className="action-desc">Schedule visit</span>
            </button>

            <button className="action-card" onClick={() => navigate('/checkin')}>
              <div className="action-card-icon">
                <QrCode size={22} />
              </div>
              <span className="action-title">Scan QR</span>
              <span className="action-desc">Arrival check-in</span>
            </button>

            <button className="action-card" onClick={() => navigate('/queue')}>
              <div className="action-card-icon">
                <Users size={22} />
              </div>
              <span className="action-title">Live Queue</span>
              <span className="action-desc">Real-time status</span>
            </button>

            <button
              className="action-card"
              onClick={() => navigate('/appointments')}
            >
              <div className="action-card-icon">
                <FileText size={22} />
              </div>
              <span className="action-title">My Appointments</span>
              <span className="action-desc">View &amp; cancel</span>
            </button>
          </div>
        </section>

        {/* All Appointments Section */}
        <section id="my-appointments-section" className="appointments-section">
          <div className="appointments-header-bar">
            <div>
              <h2 className="text-h3" style={{ margin: 0 }}>
                My Appointments
              </h2>
              <span className="text-caption">
                Manage all your upcoming and past bookings ({allAppointments.length} total)
              </span>
            </div>

            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => navigate('/appointments')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Calendar size={14} /> Full Screen View <ArrowRight size={13} />
            </button>

            {/* Filter Tabs */}
            <div className="filter-pills-row">
              <button
                type="button"
                className={`filter-pill ${filterStatus === 'ALL' ? 'active' : ''}`}
                onClick={() => setFilterStatus('ALL')}
              >
                All ({allAppointments.length})
              </button>
              <button
                type="button"
                className={`filter-pill ${filterStatus === 'BOOKED' ? 'active' : ''}`}
                onClick={() => setFilterStatus('BOOKED')}
              >
                Active Bookings ({allAppointments.filter((a) => a.status === 'BOOKED').length})
              </button>
              <button
                type="button"
                className={`filter-pill ${filterStatus === 'CANCELLED' ? 'active' : ''}`}
                onClick={() => setFilterStatus('CANCELLED')}
              >
                Cancelled ({allAppointments.filter((a) => a.status === 'CANCELLED').length})
              </button>
            </div>
          </div>

          {filteredAppointments.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center' }}>
              <p className="text-muted" style={{ margin: 0 }}>
                No appointments found for the selected filter.
              </p>
            </div>
          ) : (
            <div className="appointments-list">
              {filteredAppointments.map((appt) => {
                const isBooked = appt.status === 'BOOKED';
                const isCancelled = appt.status === 'CANCELLED';
                const isCheckedIn = appt.visit && ['CHECKED_IN', 'IN_QUEUE', 'CHECK_UP'].includes(appt.visit.status);
                const isCompleted = appt.visit && appt.visit.status === 'DONE';
                const checkInStart = appt.checkInWindow?.startTime || '09:00';
                const checkInEnd = appt.checkInWindow?.endTime || '12:00';

                return (
                  <div
                    key={appt._id}
                    className={`appointment-card ${isCancelled ? 'status-cancelled' : ''}`}
                  >
                    <div className="appointment-card-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="doc-avatar-circle" style={{ width: 44, height: 44 }}>
                          <Stethoscope size={22} color="#17345C" />
                        </div>
                        <div>
                          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                            {appt.doctorId?.name || 'Doctor'}
                          </h3>
                          <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
                            {appt.doctorId?.specialization || 'Specialist'} · {appt.clinicId?.name}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span className="badge badge-blue">
                          {appt.type === 'NEW' ? 'New Consultation' : 'Follow-Up'}
                        </span>
                        {isCancelled && <span className="badge badge-red">CANCELLED</span>}
                        {isCompleted && <span className="badge badge-green">COMPLETED</span>}
                        {isCheckedIn && <span className="badge badge-amber">TOKEN #{appt.visit?.tokenId}</span>}
                        {isBooked && !isCheckedIn && <span className="badge badge-green">CONFIRMED</span>}
                      </div>
                    </div>

                    <div className="appointment-card-body">
                      <div>
                        <span className="text-muted" style={{ display: 'block', fontSize: 12 }}>
                          Date
                        </span>
                        <strong>{appt.appointmentDate}</strong>
                      </div>

                      <div>
                        <span className="text-muted" style={{ display: 'block', fontSize: 12 }}>
                          OPD Check-In Window
                        </span>
                        <strong style={{ color: 'var(--deep-winter-blue)' }}>
                          {checkInStart} – {checkInEnd}
                        </strong>
                      </div>

                      <div style={{ gridColumn: 'span 2' }}>
                        <span className="text-muted" style={{ display: 'block', fontSize: 12 }}>
                          Check-In Requirement
                        </span>
                        <span style={{ fontSize: 12.5, color: isCancelled ? '#64748B' : '#92400E', fontWeight: 500 }}>
                          {isCancelled
                            ? 'This booking was cancelled.'
                            : `You have to check in between ${checkInStart} and ${checkInEnd} at the clinic OPD, else your appointment will be invalid.`}
                        </span>
                      </div>
                    </div>

                    {isBooked && (
                      <div className="appointment-card-actions">
                        <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                          Ref ID: <code>{appt._id}</code>
                        </span>

                        <div style={{ display: 'flex', gap: 10 }}>
                          {appt.appointmentDate === todayStr && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => navigate('/checkin')}
                            >
                              <QrCode size={14} /> Scan QR Check In
                            </button>
                          )}

                          <button
                            type="button"
                            className="btn-cancel-appt"
                            onClick={() => setAppointmentToCancel(appt)}
                          >
                            <XCircle size={14} /> Cancel Appointment
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Specialists on Duty Section */}
        <section className="specialists-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 className="text-h3">Specialists on Duty</h2>
            <span className="text-caption">City Central Clinic</span>
          </div>

          <div className="specialists-grid">
            {doctors.map((doc) => (
              <div key={doc._id} className="card doctor-tile">
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div className="doc-avatar-circle">
                    <Stethoscope size={20} color="#17345C" />
                  </div>
                  <div>
                    <h3 className="doc-name">{doc.name}</h3>
                    <span className="doc-spec">{doc.specialization || 'General Practice'}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                  <span className={`badge ${doc.availability?.status === 'AVAILABLE' ? 'badge-green' : 'badge-amber'}`}>
                    {doc.availability?.status === 'AVAILABLE' ? 'On Duty' : 'On Break'}
                  </span>
                  <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/book?doctorId=${doc._id}`)}>
                    Book Visit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Cancel Appointment Confirmation Modal */}
      <AnimatePresence>
        {appointmentToCancel && (
          <div className="modal-backdrop">
            <motion.div
              className="card card-elevated modal-content"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{ maxWidth: 440 }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'var(--error-bg, #FEF2F2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  color: 'var(--error-text, #DC2626)',
                }}
              >
                <AlertCircle size={28} />
              </div>

              <h2 className="text-h2" style={{ textAlign: 'center' }}>
                Cancel Appointment?
              </h2>
              <p className="text-muted" style={{ textAlign: 'center', fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
                Are you sure you want to cancel your appointment with{' '}
                <strong>{appointmentToCancel.doctorId?.name}</strong> on{' '}
                <strong>{appointmentToCancel.appointmentDate}</strong>?
              </p>

              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button
                  type="button"
                  className="btn btn-outline btn-block"
                  onClick={() => setAppointmentToCancel(null)}
                  disabled={cancelling}
                >
                  Keep Appointment
                </button>
                <button
                  type="button"
                  className="btn btn-block"
                  style={{
                    background: 'var(--error-text, #DC2626)',
                    color: '#fff',
                    border: 'none',
                  }}
                  onClick={handleConfirmCancel}
                  disabled={cancelling}
                >
                  {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Pill Bottom Navbar for Small Screens */}
      <BottomNav />
    </div>
  );
}
