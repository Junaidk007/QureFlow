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
  Check,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import './BookingPage.css';

// Helper to generate next 7 days for the date strip
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

  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slots, setSlots] = useState([]);
  const [selectedTime, setSelectedTime] = useState('');

  const [bookingLoading, setBookingLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successBooking, setSuccessBooking] = useState(null);

  // Load doctors on mount
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

  // Load slots whenever doctor or date changes
  useEffect(() => {
    if (!selectedDoctorId || !selectedDate) return;

    const loadSlots = async () => {
      setSlotsLoading(true);
      setErrorMsg('');
      setSelectedTime('');

      try {
        const res = await api.get(`/appointments/slots?doctorId=${selectedDoctorId}&date=${selectedDate}`);
        if (res.data && res.data.slots) {
          setSlots(res.data.slots);
        }
      } catch (err) {
        setErrorMsg('Failed to load slot schedule for this date.');
      } finally {
        setSlotsLoading(false);
      }
    };

    loadSlots();
  }, [selectedDoctorId, selectedDate]);

  const selectedDoctor = doctors.find((d) => d._id === selectedDoctorId);

  // Handle booking confirm
  const handleConfirmBooking = async () => {
    if (!selectedTime) {
      setErrorMsg('Please select a time slot.');
      return;
    }

    setBookingLoading(true);
    setErrorMsg('');

    try {
      const res = await api.post('/appointments', {
        doctorId: selectedDoctor._id,
        clinicId: selectedDoctor.clinicId?._id || selectedDoctor.clinicId,
        appointmentDate: selectedDate,
        appointmentTime: selectedTime,
        type: visitType,
      });

      setSuccessBooking(res.data);
    } catch (err) {
      setErrorMsg(err.message || 'Slot booking failed. Please try another time.');
    } finally {
      setBookingLoading(false);
    }
  };

  const morningSlots = slots.filter((s) => s.period === 'morning');
  const afternoonSlots = slots.filter((s) => s.period === 'afternoon');

  return (
    <div className="booking-page-layout">
      {/* Header */}
      <header className="booking-header">
        <button className="back-link" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={16} /> Dashboard
        </button>
        <div className="brand-name">QureFlow Booking</div>
        <div className="user-pill">{user?.name}</div>
      </header>

      {/* Main Grid Content */}
      <main className="booking-grid-container">
        {/* Left Column: Form & Schedule */}
        <div className="booking-main-col">
          {/* Doctor Header Selector */}
          <section className="card doctor-select-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span className="badge badge-blue">CONSULTING SPECIALIST</span>
              {doctors.length > 1 && (
                <select
                  className="form-input"
                  style={{ width: 'auto', height: 34, fontSize: 13 }}
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                >
                  {doctors.map((doc) => (
                    <option key={doc._id} value={doc._id}>
                      {doc.name} ({doc.specialization})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedDoctor && (
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div className="doctor-large-avatar">
                  <Stethoscope size={28} color="#17345C" />
                </div>
                <div>
                  <h2 className="text-h2">{selectedDoctor.name}</h2>
                  <p className="text-muted">{selectedDoctor.specialization}</p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <span className="badge badge-green">Available</span>
                    <span className="badge badge-blue">
                      <Building2 size={12} /> {selectedDoctor.clinicId?.name || 'City Central Health Clinic'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Visit Type Segmented Control */}
          <section style={{ marginTop: 24 }}>
            <h3 className="section-heading">Visit Type</h3>
            <div className="visit-type-pills">
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

          {/* 7-Day Date Strip */}
          <section style={{ marginTop: 24 }}>
            <h3 className="section-heading">Select Date</h3>
            <div className="date-strip">
              {daysList.map((day) => (
                <button
                  key={day.dateStr}
                  type="button"
                  className={`date-pill ${selectedDate === day.dateStr ? 'active' : ''}`}
                  onClick={() => setSelectedDate(day.dateStr)}
                >
                  <span className="date-day">{day.dayName}</span>
                  <span className="date-number">{day.dayNumber}</span>
                  <span className="date-month">{day.monthName}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Slot Grid */}
          <section style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 className="section-heading" style={{ margin: 0 }}>
                Available Time Slots
              </h3>
              <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="legend-dot available"></span> Available
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="legend-dot booked"></span> Booked
                </span>
              </div>
            </div>

            {errorMsg && (
              <div className="auth-alert error" style={{ marginBottom: 14 }}>
                <AlertCircle size={16} /> <span>{errorMsg}</span>
              </div>
            )}

            {slotsLoading ? (
              <div className="card" style={{ padding: 24, textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto 8px' }}></div>
                <p className="text-muted">Loading schedule...</p>
              </div>
            ) : (
              <div>
                {/* Morning Slots */}
                <div style={{ marginBottom: 18 }}>
                  <div className="session-title">
                    <Clock size={14} /> Morning Session (09:00 – 12:45)
                  </div>
                  <div className="slots-grid">
                    {morningSlots.map((slot) => (
                      <button
                        key={slot.time}
                        type="button"
                        className={`slot-chip ${slot.isBooked ? 'booked' : ''} ${selectedTime === slot.time ? 'selected' : ''}`}
                        disabled={slot.isBooked}
                        onClick={() => setSelectedTime(slot.time)}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Afternoon Slots */}
                <div>
                  <div className="session-title">
                    <Clock size={14} /> Afternoon Session (13:30 – 17:00)
                  </div>
                  <div className="slots-grid">
                    {afternoonSlots.map((slot) => (
                      <button
                        key={slot.time}
                        type="button"
                        className={`slot-chip ${slot.isBooked ? 'booked' : ''} ${selectedTime === slot.time ? 'selected' : ''}`}
                        disabled={slot.isBooked}
                        onClick={() => setSelectedTime(slot.time)}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Booking Summary Card */}
        <aside className="booking-summary-col">
          <div className="card card-elevated sticky-summary">
            <h3 className="text-h3" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
              Booking Summary
            </h3>

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
                <span className="text-muted">Visit Type</span>
                <span>{visitType === 'NEW' ? 'New Consultation' : 'Follow-Up'}</span>
              </div>
              <div className="summary-row">
                <span className="text-muted">Date</span>
                <strong>{selectedDate}</strong>
              </div>
              <div className="summary-row">
                <span className="text-muted">Slot Time</span>
                <strong style={{ color: selectedTime ? 'var(--deep-winter-blue)' : 'var(--muted-foreground)' }}>
                  {selectedTime ? `${selectedTime} hrs` : 'Not Selected'}
                </strong>
              </div>
            </div>

            <div className="checkin-notice-box">
              <div style={{ display: 'flex', gap: 8 }}>
                <Clock size={16} color="#17345C" style={{ flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontSize: 12, lineHeight: 1.4 }}>
                  <strong>Check-in Window:</strong> Arrive 15 mins before your slot. Scanning the arrival QR code will mint your queue token.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-block"
              style={{ marginTop: 20 }}
              disabled={bookingLoading || !selectedTime}
              onClick={handleConfirmBooking}
            >
              {bookingLoading ? (
                <div className="spinner"></div>
              ) : (
                <>
                  <Check size={16} /> Confirm &amp; Book Slot
                </>
              )}
            </button>
          </div>
        </aside>
      </main>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {successBooking && (
          <div className="modal-backdrop">
            <motion.div
              className="card card-elevated modal-content"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="modal-icon-circle">
                <CheckCircle2 size={36} color="#10B981" />
              </div>

              <h2 className="text-h2" style={{ textAlign: 'center', marginTop: 12 }}>
                Appointment Confirmed!
              </h2>
              <p className="text-muted" style={{ textAlign: 'center', fontSize: 13, marginTop: 4 }}>
                Reference ID: <code>{successBooking.appointmentId}</code>
              </p>

              <div className="confirmation-details-box" style={{ marginTop: 20 }}>
                <div className="summary-row">
                  <span className="text-muted">Specialist</span>
                  <strong>{successBooking.details?.doctorName}</strong>
                </div>
                <div className="summary-row">
                  <span className="text-muted">Date & Time</span>
                  <strong>
                    {successBooking.appointmentDate} at {successBooking.appointmentTime} hrs
                  </strong>
                </div>
                <div className="summary-row">
                  <span className="text-muted">Clinic</span>
                  <span>{successBooking.details?.clinicName}</span>
                </div>
              </div>

              <p style={{ fontSize: 12, color: 'var(--deep-winter-blue)', margin: '16px 0', textAlign: 'center', fontWeight: 500 }}>
                {successBooking.details?.checkInWindow?.notice}
              </p>

              <button className="btn btn-primary btn-block" onClick={() => navigate('/dashboard')}>
                Return to Home Dashboard
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
