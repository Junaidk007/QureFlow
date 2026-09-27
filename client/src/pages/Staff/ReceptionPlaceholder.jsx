import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, LogOut, Activity } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function ReceptionPlaceholder() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="patient-home-layout">
      <header className="home-nav">
        <div className="home-brand">
          <div className="brand-logo-icon">Q</div>
          <span className="brand-name">QureFlow Reception</span>
        </div>
        <div className="home-nav-right">
          <div className="user-profile-badge">
            <ClipboardList size={16} color="#17345C" />
            <span className="user-name">{user?.name}</span>
          </div>
          <button className="btn-icon" onClick={handleLogout} title="Sign Out">
            <LogOut size={17} />
          </button>
        </div>
      </header>

      <main className="home-content" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div className="card card-elevated" style={{ maxWidth: 520, margin: '0 auto', padding: 32 }}>
          <div className="brand-badge" style={{ margin: '0 auto 12px' }}>
            <Activity size={14} color="#17345C" /> Reception Management Desk
          </div>
          <h1 className="text-h1">Welcome, {user?.name}</h1>
          <p className="text-muted" style={{ margin: '12px 0 24px' }}>
            Reception Desk is scheduled for Phase 5. Your receptionist session is authenticated and active.
          </p>
          <div className="badge badge-blue" style={{ fontSize: 13, height: 28 }}>
            Role: RECEPTIONIST
          </div>
        </div>
      </main>
    </div>
  );
}
