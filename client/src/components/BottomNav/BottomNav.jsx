import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Users, Plus, Calendar, QrCode } from 'lucide-react';
import './BottomNav.css';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const currentPath = location.pathname;

  const isHome = currentPath === '/dashboard' || currentPath === '/';
  const isQueue = currentPath === '/queue';
  const isBook = currentPath === '/book';
  const isAppointments = currentPath === '/appointments' || currentPath === '/my-appointments';
  const isCheckIn = currentPath === '/checkin';

  return (
    <nav className="floating-bottom-nav" aria-label="Mobile Navigation">
      {/* 1. Left: Home */}
      <button
        type="button"
        className={`nav-item ${isHome ? 'active' : ''}`}
        onClick={() => navigate('/dashboard')}
        aria-label="Home"
      >
        <Home size={22} strokeWidth={isHome ? 2.5 : 1.8} />
        {/* <span className="nav-label">Home</span> */}
      </button>

      {/* 2. Next to Left: Live Queue */}
      <button
        type="button"
        className={`nav-item ${isQueue ? 'active' : ''}`}
        onClick={() => navigate('/queue')}
        aria-label="Live Queue"
      >
        <Users size={22} strokeWidth={isQueue ? 2.5 : 1.8} />
        {/* <span className="nav-label">Queue</span> */}
      </button>

      {/* 3. Center: Plus Icon for New Appointment */}
      <div className="center-plus-wrapper">
        <button
          type="button"
          className={`center-plus-btn ${isBook ? 'active' : ''}`}
          onClick={() => navigate('/book')}
          aria-label="Create Appointment"
          title="Book New Appointment"
        >
          <Plus size={26} strokeWidth={2.6} color="#FFFFFF" />
        </button>
      </div>

      {/* 4. Next to Center: My Appointment */}
      <button
        type="button"
        className={`nav-item ${isAppointments ? 'active' : ''}`}
        onClick={() => navigate('/appointments')}
        aria-label="My Appointments"
      >
        <Calendar size={22} strokeWidth={isAppointments ? 2.5 : 1.8} />
        {/* <span className="nav-label">Appointments</span> */}
      </button>

      {/* 5. Right: QR Scan */}
      <button
        type="button"
        className={`nav-item ${isCheckIn ? 'active' : ''}`}
        onClick={() => navigate('/checkin')}
        aria-label="QR Scan Arrival"
      >
        <QrCode size={22} strokeWidth={isCheckIn ? 2.5 : 1.8} />
        {/* <span className="nav-label">Scan QR</span> */}
      </button>
    </nav>
  );
}
