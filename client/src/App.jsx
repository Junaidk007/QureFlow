import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import AuthPage from './pages/Auth/AuthPage';
import PatientHomePage from './pages/PatientHome/PatientHomePage';
import BookingPage from './pages/Booking/BookingPage';
import CheckInPage from './pages/CheckIn/CheckInPage';
import QueuePage from './pages/Queue/QueuePage';
import MyAppointmentsPage from './pages/Appointments/MyAppointmentsPage';
import ReceptionPage from './pages/Reception/ReceptionPage';
import DoctorPage from './pages/Doctor/DoctorPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Screen 01: Auth Gateway */}
          <Route path="/" element={<AuthPage />} />
          <Route path="/auth" element={<AuthPage />} />

          {/* Screen 02: Patient Home Dashboard */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={['PATIENT']}>
                <PatientHomePage />
              </ProtectedRoute>
            }
          />

          {/* Screen 03: Doctor Discovery & Slot Booking */}
          <Route
            path="/book"
            element={
              <ProtectedRoute allowedRoles={['PATIENT']}>
                <BookingPage />
              </ProtectedRoute>
            }
          />

          {/* Screen 04: Arrival QR Check-In */}
          <Route
            path="/checkin"
            element={
              <ProtectedRoute allowedRoles={['PATIENT']}>
                <CheckInPage />
              </ProtectedRoute>
            }
          />

          {/* Screen 05: Live Queue Tracker */}
          <Route
            path="/queue"
            element={
              <ProtectedRoute allowedRoles={['PATIENT']}>
                <QueuePage />
              </ProtectedRoute>
            }
          />

          {/* Screen: My Appointments (Dedicated Page) */}
          <Route
            path="/appointments"
            element={
              <ProtectedRoute allowedRoles={['PATIENT']}>
                <MyAppointmentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-appointments"
            element={
              <ProtectedRoute allowedRoles={['PATIENT']}>
                <MyAppointmentsPage />
              </ProtectedRoute>
            }
          />

          {/* Screen 06: Reception Console */}
          <Route
            path="/reception"
            element={
              <ProtectedRoute allowedRoles={['RECEPTIONIST']}>
                <ReceptionPage />
              </ProtectedRoute>
            }
          />

          {/* Screen 07: Doctor Consultation & Vitals Desk */}
          <Route
            path="/doctor"
            element={
              <ProtectedRoute allowedRoles={['DOCTOR']}>
                <DoctorPage />
              </ProtectedRoute>
            }
          />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
