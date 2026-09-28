import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Stethoscope,
  Building2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Check,
  Info,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import PatientHeader from '../../components/PatientHeader/PatientHeader';
import BottomNav from '../../components/BottomNav/BottomNav';
import MuiSelect from '../../components/Mui/MuiSelect';
import './BookingPage.css';

// Helper to generate next 7 days for quick date presets
const getNext7Days = () => {
  const days = [];
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(now.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNumber = d.getDate();
    const monthName = d.toLocaleDateString('en-US', { month: 'short' });
    days.push({
      dateStr,
      dayName,
      dayNumber,
      monthName,
      isToday: i === 0,
    });
  }
  return days;
};

export default function BookingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [visitType, setVisitType] = useState('NEW');

  const daysList = getNext7Days();
  const [selectedDate, setSelectedDate] = useState(daysList[0].dateStr);

  const [bookingLoading, setBookingLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successBooking, setSuccessBooking] = useState(null);

  // Load active doctors
  useEffect(() => {
    const loadDoctors = async () => {
      try {
        const res = await api.get('/doctors/active');
        if (res.data && res.data.length > 0) {
          setDoctors(res.data);
          const paramDoctorId = searchParams.get('doctorId');
          const matched = res.data.find((d) => d._id === paramDoctorId);
          setSelectedDoctorId(matched ? matched._id : res.data[0]._id);
        }
      } catch (err) {
        console.error('Failed to load doctors:', err);
      }
    };
    loadDoctors();
  }, [searchParams]);

  const selectedDoctor = doctors.find((d) => d._id === selectedDoctorId);
  const clinic = selectedDoctor?.clinicId;
  const checkInStartTime = clinic?.checkInStartTime || '09:00';
  const checkInEndTime = clinic?.checkInEndTime || '22:00';

  // Format options for Material UI Select
  const doctorOptions = doctors.map((doc) => ({
    value: doc._id,
    label: doc.name,
    sublabel: `${doc.specialization} · ${doc.clinicId?.name || 'Clinic'}`,
  }));

  const visitTypeOptions = [
    { value: 'NEW', label: 'New Consultation', sublabel: 'First consultation with this specialist' },
    { value: 'FOLLOW-UP', label: 'Follow-Up Visit', sublabel: 'Reviewing ongoing treatment or test results' },
  ];

  // Handle booking confirm
  const handleConfirmBooking = async () => {
    if (!selectedDoctor) {
      setErrorMsg('Please select a consulting doctor.');
      return;
    }

    setBookingLoading(true);
    setErrorMsg('');

    try {
      const res = await api.post('/appointments', {
        doctorId: selectedDoctor._id,
        clinicId: selectedDoctor.clinicId?._id || selectedDoctor.clinicId,
        appointmentDate: selectedDate,
        type: visitType,
      });

      setSuccessBooking(res.data);
    } catch (err) {
      setErrorMsg(err.message || 'Appointment booking failed. Please try again.');
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="booking-page-layout">
      {/* Patient Header (Logo on left, Hamburger Menu with profile & logout on right on mobile) */}
      <PatientHeader title="Book Doctor" showBack={true} backPath="/dashboard" />

      {/* Main Grid Content */}
      <main className="booking-grid-container">
        {/* Left Column: Form & Schedule */}
        <div className="booking-main-col">
          {/* Doctor Header Selector with Material UI Dropdown */}
          <section className="card doctor-select-card">
            <div className="doctor-select-top-bar">
              <span className="badge badge-blue">CONSULTING SPECIALIST</span>
              <span className="doctor-count-hint text-muted">
                {doctors.length} Specialist{doctors.length !== 1 ? 's' : ''} Available
              </span>
            </div>

            {/* Material UI Dropdown for Doctor Selection */}
            <div className="mui-select-wrapper">
              <MuiSelect
                label="Choose Consulting Doctor"
                value={selectedDoctorId}
                onChange={(id) => {
                  setSelectedDoctorId(id);
                  setErrorMsg('');
                }}
                options={doctorOptions}
                placeholder="Select a specialist doctor"
                helperText="Select specialist for your clinical consultation"
              />
            </div>

            {selectedDoctor && (
              <div className="selected-doctor-profile">
                <div className="doctor-large-avatar">
                  <Stethoscope size={28} color="#17345C" />
                </div>
                <div className="doctor-profile-details">
                  <h2 className="doctor-profile-name">{selectedDoctor.name}</h2>
                  <p className="doctor-profile-spec text-muted">{selectedDoctor.specialization}</p>
                  <div className="doctor-badges-list">
                    <span className="badge badge-green">Available</span>
                    <span className="badge badge-blue">
                      <Building2 size={12} /> {clinic?.name || 'City Central Health Clinic'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Visit Type with Material UI Dropdown & Quick Pills */}
          <section className="booking-field-section">
            <h3 className="section-heading">Visit Type</h3>
            <MuiSelect
              label="Consultation Category"
              value={visitType}
              onChange={(val) => setVisitType(val)}
              options={visitTypeOptions}
            />

            <div className="visit-type-pills" style={{ marginTop: 8 }}>
              <button
                type="button"
                className={`type-pill ${visitType === 'NEW' ? 'active' : ''}`}
                onClick={() => setVisitType('NEW')}
              >
                New Consultation
              </button>
              <button
                type="button"
                className={`type-pill ${visitType === 'FOLLOW-UP' ? 'active' : ''}`}
                onClick={() => setVisitType('FOLLOW-UP')}
              >
                Follow-Up Visit
              </button>
            </div>
          </section>

          {/* Select Date (7-Day Strip) */}
          <section className="booking-field-section">
            <h3 className="section-heading">Select Date</h3>
            <div className="date-strip">
              {daysList.map((day) => (
                <button
                  key={day.dateStr}
                  type="button"
                  className={`date-pill ${selectedDate === day.dateStr ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedDate(day.dateStr);
                    setErrorMsg('');
                  }}
                >
                  <span className="date-day">{day.dayName}</span>
                  <span className="date-number">{day.dayNumber}</span>
                  <span className="date-month">{day.monthName}</span>
                </button>
              ))}
            </div>
          </section>

          {/* OPD Check-in Information Card */}
          <section className="booking-field-section">
            <div className="card opd-info-card">
              <div className="opd-card-content">
                <div className="opd-clock-icon-box">
                  <Clock size={24} />
                </div>
                <div>
                  <h3 className="text-h3" style={{ fontSize: 16, marginBottom: 4 }}>
                    OPD Arrival &amp; Check-In Duration
                  </h3>
                  <p className="text-muted" style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>
                    Tokens are assigned sequentially on arrival. Arrive on your chosen date within the clinic check-in hours.
                  </p>

                  <div className="opd-hours-chip">
                    <span className="badge badge-blue" style={{ fontSize: 13, padding: '4px 10px' }}>
                      Check-In Hours: {checkInStartTime} – {checkInEndTime}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                      Tokens are issued sequentially upon scanning arrival QR code.
                    </span>
                  </div>
                </div>
              </div>

              <div className="opd-warning-alert">
                <AlertTriangle size={18} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12.5, color: '#92400E', margin: 0, lineHeight: 1.45, fontWeight: 500 }}>
                  <strong>Important Notice:</strong> You have to check in between <strong>{checkInStartTime}</strong> and <strong>{checkInEndTime}</strong> on your appointment date, otherwise your appointment will be invalid and cancelled.
                </p>
              </div>
            </div>

            {errorMsg && (
              <div className="auth-alert error" style={{ marginTop: 16 }}>
                <AlertCircle size={16} /> <span>{errorMsg}</span>
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Booking Summary Card */}
        <aside className="booking-summary-col">
          <div className="card card-elevated sticky-summary">
            <h3 className="summary-card-title">Booking Summary</h3>

            <div className="summary-list">
              <div className="summary-row">
                <span className="text-muted">Doctor</span>
                <strong>{selectedDoctor?.name || '—'}</strong>
              </div>
              <div className="summary-row">
                <span className="text-muted">Specialization</span>
                <span>{selectedDoctor?.specialization || '—'}</span>
              </div>
              <div className="summary-row">
                <span className="text-muted">Clinic Facility</span>
                <span>{clinic?.name || 'City Central Health Clinic'}</span>
              </div>
              <div className="summary-row">
                <span className="text-muted">Visit Type</span>
                <span>{visitType === 'NEW' ? 'New Consultation' : 'Follow-Up Visit'}</span>
              </div>
              <div className="summary-row">
                <span className="text-muted">Appointment Date</span>
                <strong>{selectedDate}</strong>
              </div>
              <div className="summary-row">
                <span className="text-muted">Check-In Duration</span>
                <strong style={{ color: 'var(--deep-winter-blue)' }}>
                  {checkInStartTime} – {checkInEndTime}
                </strong>
              </div>
            </div>

            <div className="checkin-notice-box">
              <div style={{ display: 'flex', gap: 8 }}>
                <Clock size={16} color="#17345C" style={{ flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontSize: 12, lineHeight: 1.4, margin: 0 }}>
                  <strong>Arrival Check-In:</strong> You have to check in between <strong>{checkInStartTime} – {checkInEndTime}</strong> on {selectedDate}, else your appointment will be invalid.
                </p>
              </div>
            </div>

            {/* Confirm Button with ample spacing */}
            <div className="confirm-btn-container">
              <button
                type="button"
                className="btn btn-primary btn-block btn-confirm-booking"
                disabled={bookingLoading || !selectedDoctor}
                onClick={handleConfirmBooking}
              >
                {bookingLoading ? (
                  <div className="spinner"></div>
                ) : (
                  <>
                    <CheckCircle2 size={18} /> Confirm &amp; Book Appointment
                  </>
                )}
              </button>
            </div>
          </div>
        </aside>
      </main>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {successBooking && (
          <div className="modal-backdrop" onClick={() => navigate('/dashboard')}>
            <motion.div
              className="card modal-content"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-icon-circle">
                <Check size={36} color="#15803D" />
              </div>

              <h2 className="text-h2" style={{ textAlign: 'center', marginTop: 16 }}>
                Appointment Confirmed!
              </h2>
              <p className="text-muted" style={{ textAlign: 'center', marginBottom: 20 }}>
                Your clinical consultation has been booked successfully.
              </p>

              <div className="confirmation-details-box">
                <div className="summary-row">
                  <span className="text-muted">Doctor</span>
                  <strong>{successBooking.details?.doctorName || selectedDoctor?.name}</strong>
                </div>
                <div className="summary-row">
                  <span className="text-muted">Date</span>
                  <strong>{successBooking.details?.appointmentDate || selectedDate}</strong>
                </div>
                <div className="summary-row">
                  <span className="text-muted">Check-In Window</span>
                  <strong style={{ color: 'var(--deep-winter-blue)' }}>
                    {successBooking.details?.checkInWindow?.startTime || checkInStartTime} – {successBooking.details?.checkInWindow?.endTime || checkInEndTime}
                  </strong>
                </div>
              </div>

              <div className="modal-warning-box">
                ⚠️ <strong>Notice:</strong> You have to check in between <strong>{successBooking.details?.checkInWindow?.startTime || checkInStartTime}</strong> and <strong>{successBooking.details?.checkInWindow?.endTime || checkInEndTime}</strong>, else your appointment will be invalid.
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-block"
                  onClick={() => navigate('/dashboard')}
                >
                  Back to Dashboard
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  onClick={() => navigate('/appointments')}
                >
                  My Appointments
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Pill Bottom Navbar for mobile */}
      <BottomNav />
    </div>
  );
}
