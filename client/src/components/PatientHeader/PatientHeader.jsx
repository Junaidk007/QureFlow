import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, ArrowLeft, Menu, X, Home, Calendar, Users, Plus, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './PatientHeader.css';

export default function PatientHeader({
  title = 'QureFlow',
  subtitle = null,
  showBack = false,
  backPath = '/dashboard',
  rightExtra = null,
}) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const initial = user?.name ? user.name[0].toUpperCase() : 'P';

  // Close hamburger menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [menuOpen]);

  return (
    <header className="patient-app-header">
      {/* Left Slot: Mobile Logo OR Desktop Back/Brand */}
      <div className="header-slot-left">
        {/* Mobile: Logo on Top Left Corner */}
        <div
          className="mobile-brand-corner"
          onClick={() => navigate('/dashboard')}
          title="QureFlow Home"
        >
          <div className="brand-logo-icon">Q</div>
          {/* <span className="mobile-brand-text">QureFlow</span> */}
        </div>

        {/* Desktop: Back Button if enabled, otherwise brand */}
        {showBack ? (
          <button className="desktop-back-btn" onClick={() => navigate(backPath)}>
            <ArrowLeft size={16} /> Back
          </button>
        ) : (
          <div className="desktop-brand-group" onClick={() => navigate('/dashboard')}>
            <div className="brand-logo-icon">Q</div>
            <span className="brand-name">QureFlow</span>
          </div>
        )}
      </div>

      {/* Center Slot: Page Title / Brand */}
      <div className="header-slot-center">
        <span className="center-page-title">{title}</span>
        {subtitle && <span className="center-page-subtitle">{subtitle}</span>}
      </div>

      {/* Right Slot: Desktop User Pill + Logout OR Mobile Hamburger Menu */}
      <div className="header-slot-right" ref={menuRef}>
        {rightExtra}

        {/* Desktop User Badge */}
        <div className="desktop-user-pill">
          <span className="user-avatar-initial small">{initial}</span>
          <span className="user-display-name">{user?.name || 'Patient'}</span>
        </div>

        {/* Desktop Logout Button */}
        <button
          className="btn-icon desktop-logout-btn"
          onClick={handleLogout}
          title="Sign Out"
          aria-label="Sign Out"
        >
          <LogOut size={17} />
        </button>

        {/* Mobile Hamburger Menu Toggle Button on Top Right */}
        <button
          className={`mobile-hamburger-btn ${menuOpen ? 'active' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation menu"
          title="Menu"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Small Box-Type Hamburger Dropdown Menu on Mobile */}
        {menuOpen && (
          <div className="hamburger-box-menu" role="menu">
            {/* User Profile Header in Box */}
            <div className="box-menu-user-card" onClick={() => { setMenuOpen(false); navigate('/dashboard'); }}>
              <div className="user-avatar-initial">{initial}</div>
              <div className="box-menu-user-details">
                <span className="box-menu-user-name">{user?.name || 'Patient'}</span>
                <span className="box-menu-user-email">{user?.email || 'patient@qureflow.com'}</span>
                <span className="box-menu-role-badge">{user?.role || 'PATIENT'}</span>
              </div>
            </div>

            <div className="box-menu-divider" />

            {/* Quick Actions & Navigation */}
            <button
              type="button"
              className="box-menu-item"
              onClick={() => {
                setMenuOpen(false);
                navigate('/dashboard');
              }}
            >
              <Home size={16} />
              <span>Home Dashboard</span>
            </button>

           

            <div className="box-menu-divider" />

            {/* Logout Action in Box */}
            <button
              type="button"
              className="box-menu-item box-logout-item"
              onClick={() => {
                setMenuOpen(false);
                handleLogout();
              }}
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
