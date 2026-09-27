import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Stethoscope,
  Clock,
  UserPlus,
  AlertTriangle,
  UserX,
  XCircle,
  RefreshCw,
  LogOut,
  Building2,
  Phone,
  Flame,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useWebSocket from '../../hooks/useWebSocket';
import api from '../../api/client';
import './ReceptionPage.css';

export default function ReceptionPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState([]);
  const [kpi, setKpi] = useState({
    waitingInLobby: 0,
    inConsultation: 0,
    completedToday: 0,
    noShows: 0,
    totalVisits: 0,
  });

  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState('ALL');

  // Walk-in Drawer
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [walkInForm, setWalkInForm] = useState({
    patientName: '',
    phone: '',
    doctorId: '',
    type: 'NEW',
    isUrgent: false,
  });
  const [submittingWalkIn, setSubmittingWalkIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const clinicId = user?.clinicId?._id || user?.clinicId;

  // Fetch visits and KPIs
  const fetchData = useCallback(async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const docQuery = selectedDoctorFilter !== 'ALL' ? `&doctorId=${selectedDoctorFilter}` : '';

      const [visitsRes, kpiRes, doctorsRes] = await Promise.all([
        api.get(`/visits?clinicId=${clinicId}&date=${todayStr}${docQuery}`),
        api.get(`/visits/reception-kpi?clinicId=${clinicId}&date=${todayStr}`),
        api.get('/doctors/active'),
      ]);

      if (visitsRes.data) setVisits(visitsRes.data);
      if (kpiRes.data) setKpi(kpiRes.data);
      if (doctorsRes.data) {
        setDoctors(doctorsRes.data);
        if (!walkInForm.doctorId && doctorsRes.data.length > 0) {
          setWalkInForm((prev) => ({ ...prev, doctorId: doctorsRes.data[0]._id }));
        }
      }
    } catch (err) {
      console.error('Failed to load reception data:', err);
    } finally {
      setLoading(false);
    }
  }, [clinicId, selectedDoctorFilter, walkInForm.doctorId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time WebSocket synchronization
  const handleWsEvent = useCallback(
    (event) => {
      if (event === 'QUEUE_UPDATED' || event === 'DOCTOR_STATUS_CHANGED') {
        fetchData();
      }
    },
    [fetchData]
  );

  const rooms = clinicId ? [`clinic:${clinicId}`] : [];
  const { isConnected } = useWebSocket(rooms, handleWsEvent);

  // Status update (No-show, Cancel)
  const handleStatusChange = async (visitId, newStatus) => {
    try {
      await api.put(`/visits/${visitId}/status`, { status: newStatus });
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to update visit status');
    }
  };

  // Toggle Urgent Priority
  const handleTogglePriority = async (visitId) => {
    try {
      await api.put(`/visits/${visitId}/priority`);
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to toggle priority');
    }
  };

  // Submit Walk-in
  const handleWalkInSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmittingWalkIn(true);

    try {
      await api.post('/visits/walk-in', {
        clinicId,
        patientName: walkInForm.patientName,
        phone: walkInForm.phone,
        doctorId: walkInForm.doctorId,
        type: walkInForm.type,
        isUrgent: walkInForm.isUrgent,
      });

      setShowWalkInModal(false);
      setWalkInForm({
        patientName: '',
        phone: '',
        doctorId: doctors[0]?._id || '',
        type: 'NEW',
        isUrgent: false,
      });
      fetchData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to register walk-in patient.');
    } finally {
      setSubmittingWalkIn(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="reception-page-layout">
      {/* Header */}
      <header className="reception-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="brand-logo-icon">Q</div>
          <div>
            <div className="brand-name">QureFlow Reception Console</div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
              City Central Health Clinic · Facility ID #{clinicId?.substring(0, 8)}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="live-pill">
            <span className={`pulse-dot ${isConnected ? 'online' : 'offline'}`}></span>
            <span>{isConnected ? 'Real-Time Feed Active' : 'Connecting...'}</span>
          </div>

          <div className="user-profile-badge">
            <Users size={15} color="#17345C" />
            <span className="user-name">{user?.name} (Reception)</span>
          </div>

          <button className="btn-icon" onClick={handleLogout} title="Sign Out">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="reception-content-wrapper">
        {/* KPI Strip */}
        <section className="stats-kpi-grid">
          <div className="stat-card">
            <span className="stat-card-label">WAITING IN LOBBY</span>
            <div className="stat-card-value" style={{ color: 'var(--deep-winter-blue)' }}>
              {kpi.waitingInLobby}
            </div>
            <span className="stat-card-sub">In queue</span>
          </div>

          <div className="stat-card">
            <span className="stat-card-label">IN CONSULTATION</span>
            <div className="stat-card-value" style={{ color: '#047857' }}>
              {kpi.inConsultation}
            </div>
            <span className="stat-card-sub">Active encounters</span>
          </div>

          <div className="stat-card">
            <span className="stat-card-label">COMPLETED TODAY</span>
            <div className="stat-card-value" style={{ color: '#10B981' }}>
              {kpi.completedToday}
            </div>
            <span className="stat-card-sub">Patients discharged</span>
          </div>

          <div className="stat-card">
            <span className="stat-card-label">NO-SHOWS / CANCELLED</span>
            <div className="stat-card-value" style={{ color: '#EF4444' }}>
              {kpi.noShows}
            </div>
            <span className="stat-card-sub">Slots released</span>
          </div>
        </section>

        {/* Toolbar & Filter Tabs */}
        <section className="table-toolbar-bar">
          <div className="doctor-filter-tabs">
            <button
              type="button"
              className={`doc-filter-btn ${selectedDoctorFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setSelectedDoctorFilter('ALL')}
            >
              All Doctors ({doctors.length})
            </button>
            {doctors.map((doc) => (
              <button
                key={doc._id}
                type="button"
                className={`doc-filter-btn ${selectedDoctorFilter === doc._id ? 'active' : ''}`}
                onClick={() => setSelectedDoctorFilter(doc._id)}
              >
                {doc.name.split(' ').slice(1).join(' ')}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-outline btn-sm" onClick={fetchData} title="Refresh Table">
              <RefreshCw size={14} /> Refresh
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowWalkInModal(true)}
              style={{ height: 38, padding: '0 16px' }}
            >
              <UserPlus size={16} /> + Add Walk-In Patient
            </button>
          </div>
        </section>

        {/* Master Live Queue Table */}
        <section className="card table-container-card">
          <div style={{ overflowX: 'auto' }}>
            <table className="reception-table">
              <thead>
                <tr>
                  <th>TOKEN</th>
                  <th>PATIENT INFO</th>
                  <th>ASSIGNED SPECIALIST</th>
                  <th>TYPE</th>
                  <th>ARRIVAL TIME</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {visits.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--muted-foreground)' }}>
                      No patient visits registered in queue today. Click <strong>+ Add Walk-In Patient</strong> to create one.
                    </td>
                  </tr>
                ) : (
                  visits.map((v) => {
                    const arrivalTimeStr = new Date(v.checkedInAt).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <tr key={v._id} className={v.isUrgent ? 'urgent-row' : ''}>
                        {/* Token */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="token-badge-pill">{v.tokenId}</span>
                            {v.isUrgent && (
                              <span className="urgent-badge" title="Urgent High-Priority Patient">
                                <Flame size={12} /> URGENT
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Patient Info */}
                        <td>
                          <div style={{ fontWeight: 600 }}>{v.patientId?.name || 'Walk-In Patient'}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                            {v.patientId?.phone || v.patientId?.email || 'No phone'}
                          </div>
                        </td>

                        {/* Doctor */}
                        <td>
                          <div style={{ fontWeight: 600 }}>{v.doctorId?.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                            {v.doctorId?.specialization}
                          </div>
                        </td>

                        {/* Type */}
                        <td>
                          <span className="badge badge-blue">
                            {v.appointmentId ? 'Booked' : 'Walk-In'}
                          </span>
                        </td>

                        {/* Arrival */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                            <Clock size={13} color="var(--muted-foreground)" /> {arrivalTimeStr}
                          </div>
                        </td>

                        {/* Status */}
                        <td>
                          <span
                            className={`badge ${
                              v.status === 'IN_QUEUE'
                                ? 'badge-blue'
                                : v.status === 'CHECK_UP'
                                ? 'badge-amber'
                                : v.status === 'DONE'
                                ? 'badge-green'
                                : 'badge-red'
                            }`}
                          >
                            {v.status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            {v.status === 'IN_QUEUE' && (
                              <>
                                <button
                                  className={`btn-action ${v.isUrgent ? 'active' : ''}`}
                                  onClick={() => handleTogglePriority(v._id)}
                                  title="Toggle Urgent Priority"
                                >
                                  <Flame size={14} />
                                </button>
                                <button
                                  className="btn-action destructive"
                                  onClick={() => handleStatusChange(v._id, 'NO_SHOW')}
                                  title="Mark as No-Show"
                                >
                                  <UserX size={14} />
                                </button>
                                <button
                                  className="btn-action destructive"
                                  onClick={() => handleStatusChange(v._id, 'CANCELLED')}
                                  title="Cancel Visit"
                                >
                                  <XCircle size={14} />
                                </button>
                              </>
                            )}
                            {v.status === 'DONE' && (
                              <span style={{ fontSize: 12, color: '#10B981', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <CheckCircle size={14} /> Complete
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Walk-In Drawer / Modal */}
      <AnimatePresence>
        {showWalkInModal && (
          <div className="modal-backdrop">
            <motion.div
              className="card card-elevated walkin-modal"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <span className="badge badge-blue">RECEPTION DESK</span>
                  <h2 className="text-h2" style={{ marginTop: 4 }}>Add Walk-In Patient</h2>
                </div>
                <button className="btn-icon" onClick={() => setShowWalkInModal(false)}>
                  ✕
                </button>
              </div>

              {errorMsg && (
                <div className="auth-alert error" style={{ marginBottom: 14 }}>
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleWalkInSubmit}>
                <div className="form-group">
                  <label className="form-label">Patient Full Name *</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Michael Brown"
                    value={walkInForm.patientName}
                    onChange={(e) => setWalkInForm({ ...walkInForm, patientName: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Contact Mobile Number</label>
                  <input
                    className="form-input"
                    type="tel"
                    placeholder="e.g. +1 555-0192"
                    value={walkInForm.phone}
                    onChange={(e) => setWalkInForm({ ...walkInForm, phone: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Assigned Specialist *</label>
                  <select
                    className="form-input"
                    value={walkInForm.doctorId}
                    onChange={(e) => setWalkInForm({ ...walkInForm, doctorId: e.target.value })}
                    required
                  >
                    {doctors.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name} ({d.specialization})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Visit Consultation Type</label>
                  <select
                    className="form-input"
                    value={walkInForm.type}
                    onChange={(e) => setWalkInForm({ ...walkInForm, type: e.target.value })}
                  >
                    <option value="NEW">New Patient Consultation</option>
                    <option value="FOLLOW-UP">Follow-Up Triage</option>
                  </select>
                </div>

                {/* Urgent Priority Checkbox */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, backgroundColor: 'var(--muted)', borderRadius: 8, margin: '14px 0' }}>
                  <input
                    type="checkbox"
                    id="urgent-check"
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                    checked={walkInForm.isUrgent}
                    onChange={(e) => setWalkInForm({ ...walkInForm, isUrgent: e.target.checked })}
                  />
                  <label htmlFor="urgent-check" style={{ fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Urgent Clinical Triage (Injects at Front of Queue)
                  </label>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ flex: 1 }}
                    onClick={() => setShowWalkInModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    disabled={submittingWalkIn || !walkInForm.patientName}
                  >
                    {submittingWalkIn ? 'Minting Token...' : 'Mint Walk-In Token'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
