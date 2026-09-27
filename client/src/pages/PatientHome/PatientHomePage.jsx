import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import './PatientHomePage.css';

export default function PatientHomePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [activeVisitData, setActiveVisitData] = useState(null);
  const [upcomingAppointment, setUpcomingAppointment] = useState(null);
  const [doctors, setDoctors] = useState([]);

  // Load patient dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        // 1. Check for active visit in queue today
        const statusRes = await api.get('/visits/my-status');
        if (statusRes.data && statusRes.data.hasActiveVisit) {
          setActiveVisitData(statusRes.data);
        }

        // 2. Fetch upcoming booked appointment
        const apptRes = await api.get('/appointments/my-upcoming');
        if (apptRes.data) {
          setUpcomingAppointment(apptRes.data);
        }

        // 3. Fetch active specialists on duty
        const docRes = await api.get('/doctors/active');
        if (docRes.data) {
          setDoctors(docRes.data);
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const isApptToday = upcomingAppointment && upcomingAppointment.appointmentDate === todayStr;

  return (
    <div className="patient-home-layout">
      {/* Top Application Header */}
      <header className="home-nav">
        <div className="home-brand">
          <div className="brand-logo-icon">Q</div>
          <span className="brand-name">QureFlow</span>
        </div>

        <div className="home-nav-right">
          <div className="user-profile-badge">
            <span className="user-avatar-initial">{user?.name ? user.name[0].toUpperCase() : 'P'}</span>
            <span className="user-name">{user?.name || 'Patient'}</span>
          </div>

          <button className="btn-icon" onClick={handleLogout} title="Sign Out">
            <LogOut size={17} />
          </button>
        </div>
      </header>

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
                    {upcomingAppointment.appointmentTime} hrs — {upcomingAppointment.doctorId?.name}
                  </h2>
                </div>
                <div className="badge badge-blue">
                  {upcomingAppointment.type === 'NEW' ? 'New Consultation' : 'Follow-up'}
                </div>
              </div>

              <div className="context-card-body">
                <p className="text-muted">
                  Specialization: {upcomingAppointment.doctorId?.specialization} · Clinic: {upcomingAppointment.clinicId?.name}
                </p>
                <p style={{ marginTop: 8, fontSize: 13, color: 'var(--deep-winter-blue)', fontWeight: 500 }}>
                  Arrival Notice: Please check in 15 minutes before your slot to mint your queue token.
                </p>
              </div>

              <div className="context-card-footer">
                <button className="btn btn-primary" onClick={() => navigate('/checkin')}>
                  <QrCode size={16} /> Scan QR to Check In <ArrowRight size={15} />
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
                    Reserve your consultation slot with a specialist in advance to skip physical waiting queues.
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
              <span className="action-title">Book Slot</span>
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

            <button className="action-card" onClick={() => alert('Past visits and clinical notes archive.')}>
              <div className="action-card-icon">
                <FileText size={22} />
              </div>
              <span className="action-title">Past Visits</span>
              <span className="action-desc">Medical records</span>
            </button>
          </div>
        </section>

        {/* Specialists on Duty Carousel */}
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
                    Book Slot
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
