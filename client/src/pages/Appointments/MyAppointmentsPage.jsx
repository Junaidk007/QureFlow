import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  ArrowLeft,
  Stethoscope,
  Building2,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  QrCode,
  Plus,
  LogOut,
  User,
  Filter,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import PatientHeader from '../../components/PatientHeader/PatientHeader';
import BottomNav from '../../components/BottomNav/BottomNav';
import './MyAppointmentsPage.css';

export default function MyAppointmentsPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Cancel Modal state
  const [appointmentToCancel, setAppointmentToCancel] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/appointments/my-appointments');
      if (res.data) {
        setAppointments(res.data);
      }
    } catch (err) {
      console.error('Failed to load appointments:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const handleCancelAppointment = async () => {
    if (!appointmentToCancel) return;
    setCancelling(true);
    setFeedbackMsg('');

    try {
      await api.put(`/appointments/${appointmentToCancel._id}/cancel`);
      setFeedbackMsg('Appointment successfully cancelled.');
      setAppointmentToCancel(null);
      await fetchAppointments();
      setTimeout(() => setFeedbackMsg(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to cancel appointment.');
    } finally {
      setCancelling(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredAppointments = appointments.filter((appt) => {
    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'BOOKED') return appt.status === 'BOOKED';
    if (filterStatus === 'CANCELLED') return appt.status === 'CANCELLED';
    if (filterStatus === 'COMPLETED') return appt.visit?.status === 'DONE';
    return true;
  });

  return (
    <div className="my-appointments-layout">
      {/* Standard Patient Header (Profile on top-left, Logout on top-right on mobile) */}
      <PatientHeader title="My Appointments" showBack={true} backPath="/dashboard" />

      {/* Main Content */}
      <main className="appointments-content">
        {/* Header Hero Banner */}
        <section className="appointments-hero-banner">
          <div>
            <h1 className="text-h1">My Appointments</h1>
            <p className="text-muted">
              View, manage, track, and cancel all your clinic consultations.
            </p>
          </div>

          <button className="btn btn-primary btn-book-new" onClick={() => navigate('/book')}>
            <Plus size={16} /> Book New Appointment
          </button>
        </section>

        {feedbackMsg && (
          <div className="feedback-banner success">
            <CheckCircle2 size={18} color="#059669" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* Filter Controls */}
        <section className="filter-tabs-bar">
          <div className="filter-pills-container">
            <button
              type="button"
              className={`filter-tab ${filterStatus === 'ALL' ? 'active' : ''}`}
              onClick={() => setFilterStatus('ALL')}
            >
              All ({appointments.length})
            </button>
            <button
              type="button"
              className={`filter-tab ${filterStatus === 'BOOKED' ? 'active' : ''}`}
              onClick={() => setFilterStatus('BOOKED')}
            >
              Active / Confirmed ({appointments.filter((a) => a.status === 'BOOKED').length})
            </button>
            <button
              type="button"
              className={`filter-tab ${filterStatus === 'COMPLETED' ? 'active' : ''}`}
              onClick={() => setFilterStatus('COMPLETED')}
            >
              Completed ({appointments.filter((a) => a.visit?.status === 'DONE').length})
            </button>
            <button
              type="button"
              className={`filter-tab ${filterStatus === 'CANCELLED' ? 'active' : ''}`}
              onClick={() => setFilterStatus('CANCELLED')}
            >
              Cancelled ({appointments.filter((a) => a.status === 'CANCELLED').length})
            </button>
          </div>
        </section>

        {/* Appointments List */}
        {loading ? (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }}></div>
            <p className="text-muted">Loading your appointments...</p>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="card empty-appointments-card">
            <div className="empty-icon-circle">
              <Calendar size={32} color="#17345C" />
            </div>
            <h2 className="text-h2">No Appointments Found</h2>
            <p className="text-muted" style={{ maxWidth: 440, margin: '8px auto 20px' }}>
              {filterStatus === 'ALL'
                ? "You don't have any appointments scheduled yet. Book your visit in advance to receive your check-in time window."
                : `No appointments found matching the "${filterStatus.toLowerCase()}" filter.`}
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/book')}>
              <Plus size={16} /> Book an Appointment
            </button>
          </div>
        ) : (
          <div className="appointments-cards-grid">
            {filteredAppointments.map((appt) => {
              const isBooked = appt.status === 'BOOKED';
              const isCancelled = appt.status === 'CANCELLED';
              const isCheckedIn = appt.visit && ['CHECKED_IN', 'IN_QUEUE', 'CHECK_UP'].includes(appt.visit.status);
              const isCompleted = appt.visit && appt.visit.status === 'DONE';
              const isToday = appt.appointmentDate === todayStr;
              const checkInStart = appt.checkInWindow?.startTime || '09:00';
              const checkInEnd = appt.checkInWindow?.endTime || '12:00';

              return (
                <div
                  key={appt._id}
                  className={`card appt-item-card ${isCancelled ? 'cancelled-card' : ''}`}
                >
                  <div className="card-top-row">
                    <div className="doc-avatar-info">
                      <div className="doc-avatar-box">
                        <Stethoscope size={22} color="#17345C" />
                      </div>
                      <div>
                        <h2 className="doc-item-name">{appt.doctorId?.name || 'Doctor'}</h2>
                        <span className="doc-item-spec">
                          {appt.doctorId?.specialization || 'Specialist'}
                        </span>
                        <div className="clinic-item-sub">
                          <Building2 size={13} /> {appt.clinicId?.name || 'Central Clinic'}
                        </div>
                      </div>
                    </div>

                    <div className="badge-status-group">
                      <span className="badge badge-blue">
                        {appt.type === 'NEW' ? 'New Consultation' : 'Follow-Up'}
                      </span>
                      {isCancelled && <span className="badge badge-red">CANCELLED</span>}
                      {isCompleted && <span className="badge badge-green">COMPLETED</span>}
                      {isCheckedIn && <span className="badge badge-amber">TOKEN #{appt.visit?.tokenId}</span>}
                      {isBooked && !isCheckedIn && <span className="badge badge-green">CONFIRMED</span>}
                    </div>
                  </div>

                  {/* Date & Check-in window detail box */}
                  <div className="card-details-grid">
                    <div className="detail-col">
                      <span className="detail-label">Date of Consultation</span>
                      <strong className="detail-value">{appt.appointmentDate}</strong>
                      {isToday && <span className="badge badge-amber today-tag">Today</span>}
                    </div>

                    <div className="detail-col">
                      <span className="detail-label">OPD Check-In Window</span>
                      <div className="window-pill">
                        <Clock size={14} color="#17345C" />
                        <span>{checkInStart} – {checkInEnd}</span>
                      </div>
                    </div>
                  </div>

                  {/* Mandatory Check-in warning alert */}
                  {!isCancelled && (
                    <div className="mandatory-checkin-alert">
                      <AlertTriangle size={16} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
                      <p>
                        <strong>Check-In Requirement:</strong> You have to check in between <strong>{checkInStart}</strong> and <strong>{checkInEnd}</strong> on {appt.appointmentDate} at the clinic OPD, else your appointment will be invalid.
                      </p>
                    </div>
                  )}

                  {isCancelled && (
                    <div className="mandatory-checkin-alert cancelled">
                      <XCircle size={16} color="#EF4444" style={{ flexShrink: 0, marginTop: 2 }} />
                      <p>This appointment has been cancelled and cannot be used for check-in.</p>
                    </div>
                  )}

                  {/* Footer actions */}
                  <div className="card-actions-row">
                    <span className="ref-code">Ref #{appt._id.substring(0, 8)}</span>

                    <div className="actions-buttons-group">
                      {isBooked && isToday && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => navigate('/checkin')}
                        >
                          <QrCode size={15} /> Check In Now
                        </button>
                      )}

                      {isBooked && (
                        <button
                          type="button"
                          className="btn-cancel-appt"
                          onClick={() => setAppointmentToCancel(appt)}
                        >
                          <XCircle size={15} /> Cancel Appointment
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Pill Bottom Navbar (Mobile only) */}
      <BottomNav />

      {/* Cancellation Confirmation Modal */}
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
              <div className="cancel-icon-circle">
                <AlertTriangle size={28} />
              </div>

              <h2 className="text-h2" style={{ textAlign: 'center' }}>
                Cancel Appointment?
              </h2>
              <p className="text-muted" style={{ textAlign: 'center', fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
                Are you sure you want to cancel your consultation with{' '}
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
                  onClick={handleCancelAppointment}
                  disabled={cancelling}
                >
                  {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
