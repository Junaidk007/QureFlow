import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Clock,
  Users,
  Stethoscope,
  Building2,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  XCircle,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useWebSocket from '../../hooks/useWebSocket';
import api from '../../api/client';
import './QueuePage.css';

export default function QueuePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [queueData, setQueueData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [calledModal, setCalledModal] = useState(false);
  const [completedData, setCompletedData] = useState(null);

  // Fetch status via REST
  const fetchQueueStatus = useCallback(async () => {
    try {
      const res = await api.get('/visits/my-status');
      if (res.data && res.data.hasActiveVisit) {
        setQueueData(res.data);
        if (res.data.visit.status === 'CHECK_UP') {
          setCalledModal(true);
        }
      } else {
        setQueueData(null);
      }
    } catch (err) {
      console.error('Failed to sync queue:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueueStatus();
  }, [fetchQueueStatus]);

  // WebSocket event handler
  const handleWsEvent = useCallback(
    (event, payload) => {
      if (event === 'QUEUE_UPDATED' || event === 'DOCTOR_STATUS_CHANGED') {
        fetchQueueStatus();
      } else if (event === 'VISIT_CALLED') {
        if (payload?.tokenId === queueData?.visit?.tokenId) {
          setCalledModal(true);
        }
        fetchQueueStatus();
      } else if (event === 'VISIT_COMPLETED') {
        if (payload?.tokenId === queueData?.visit?.tokenId) {
          setCompletedData(payload);
        }
        fetchQueueStatus();
      }
    },
    [fetchQueueStatus, queueData]
  );

  // Subscribe to clinic and patient rooms
  const rooms = [];
  if (queueData?.visit?.clinicId?._id) rooms.push(`clinic:${queueData.visit.clinicId._id}`);
  if (queueData?.visit?.doctorId?._id) rooms.push(`doctor:${queueData.visit.doctorId._id}`);
  if (user?._id) rooms.push(`patient:${user._id}`);

  const { isConnected } = useWebSocket(rooms, handleWsEvent);

  // Cancel / Leave queue
  const handleCancelVisit = async () => {
    setCancelling(true);
    try {
      await api.post('/visits/cancel');
      navigate('/dashboard');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to cancel visit.');
    } finally {
      setCancelling(false);
      setShowCancelModal(false);
    }
  };

  if (loading) {
    return (
      <div className="queue-page-layout">
        <header className="queue-header">
          <button className="back-link" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={16} /> Dashboard
          </button>
          <div className="brand-name">Live Queue Tracker</div>
        </header>
        <div style={{ padding: 60, textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }}></div>
          <p className="text-muted">Loading live queue telemetry...</p>
        </div>
      </div>
    );
  }

  if (!queueData) {
    return (
      <div className="queue-page-layout">
        <header className="queue-header">
          <button className="back-link" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={16} /> Dashboard
          </button>
          <div className="brand-name">Live Queue Tracker</div>
        </header>
        <div className="queue-content-wrapper" style={{ textAlign: 'center', paddingTop: 60 }}>
          <div className="card" style={{ padding: 32 }}>
            <Activity size={36} color="#17345C" style={{ margin: '0 auto 12px' }} />
            <h2 className="text-h2">No Active Visit Found</h2>
            <p className="text-muted" style={{ margin: '8px 0 20px' }}>
              You are currently not waiting in any clinic queue.
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { visit, eta, currentlyServing, doctorStatus } = queueData;
  const patientsAhead = eta?.patientsAhead || 0;
  const isNextInLine = patientsAhead <= 1;

  // Step indexes
  const statusSteps = ['BOOKED', 'CHECKED_IN', 'IN_QUEUE', 'CHECK_UP', 'DONE'];
  const currentStepIndex = statusSteps.indexOf(visit.status);

  return (
    <div className="queue-page-layout">
      {/* Top Header */}
      <header className="queue-header">
        <button className="back-link" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={16} /> Dashboard
        </button>

        <div className="header-clinic-meta">
          <strong>{visit.clinicId?.name || 'Clinic'}</strong>
          <span className="text-muted">· {visit.doctorId?.name}</span>
        </div>

        <div className="live-pill">
          <span className={`pulse-dot ${isConnected ? 'online' : 'offline'}`}></span>
          <span>{isConnected ? 'Live Sync Active' : 'Connecting...'}</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="queue-content-wrapper">
        {/* Proximity Alert Banner (if 1 or 0 patients ahead) */}
        <AnimatePresence>
          {isNextInLine && visit.status === 'IN_QUEUE' && (
            <motion.div
              className="proximity-alert-banner"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <AlertTriangle size={20} color="#B45309" />
                <div>
                  <strong>Proximity Notice: You are next in line!</strong>
                  <p style={{ fontSize: 12, marginTop: 2 }}>
                    Please wait immediately outside the consultation cabin.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Token Hero Card */}
        <div className="card token-hero-card">
          <span className="token-card-subtitle">YOUR OFFICIAL QUEUE TOKEN</span>
          <div className="token-hero-number">{visit.tokenId}</div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
            <span className={`badge ${visit.status === 'CHECK_UP' ? 'badge-green' : 'badge-blue'}`}>
              Status: {visit.status === 'CHECK_UP' ? 'IN CONSULTATION' : 'WAITING IN QUEUE'}
            </span>
            <span className={`badge ${doctorStatus === 'AVAILABLE' ? 'badge-green' : 'badge-amber'}`}>
              Specialist: {doctorStatus === 'AVAILABLE' ? 'Available' : 'On Break'}
            </span>
          </div>

          <p className="text-muted" style={{ fontSize: 13, marginTop: 12 }}>
            Consultation Cabin · {visit.doctorId?.name} ({visit.doctorId?.specialization})
          </p>
        </div>

        {/* 3-Metrics Cluster */}
        <div className="queue-metrics-strip">
          <div className="metric-box">
            <span className="metric-label">PATIENTS AHEAD</span>
            <div className="metric-value" style={{ color: patientsAhead === 0 ? '#10B981' : 'var(--deep-winter-blue)' }}>
              {patientsAhead}
            </div>
            <span className="metric-sub">{patientsAhead === 0 ? 'You are next' : 'In queue'}</span>
          </div>

          <div className="metric-box">
            <span className="metric-label">ESTIMATED WAIT</span>
            <div className="metric-value">{eta?.formattedRange || '0–10 mins'}</div>
            <span className="metric-sub">Dynamic range</span>
          </div>

          <div className="metric-box">
            <span className="metric-label">CURRENTLY SERVING</span>
            <div className="metric-value" style={{ color: '#047857' }}>
              {currentlyServing || 'None'}
            </div>
            <span className="metric-sub">In doctor room</span>
          </div>
        </div>

        {/* 5-Step Visual Stepper */}
        <div className="card stepper-card">
          <h3 className="text-h3" style={{ marginBottom: 16 }}>
            Visit Journey
          </h3>
          <div className="stepper-track">
            {['Booked', 'Checked In', 'In Queue', 'Consultation', 'Done'].map((step, idx) => {
              const isPast = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;

              return (
                <div key={step} className={`step-node ${isPast ? 'past' : ''} ${isCurrent ? 'current' : ''}`}>
                  <div className="step-circle">{isPast ? '✓' : idx + 1}</div>
                  <span className="step-label">{step}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <button
            type="button"
            className="btn btn-outline btn-destructive"
            style={{ width: '100%', maxWidth: 320 }}
            onClick={() => setShowCancelModal(true)}
          >
            Leave Queue / Cancel Visit
          </button>
        </div>
      </main>

      {/* Turn Notification Fullscreen Modal */}
      <AnimatePresence>
        {calledModal && (
          <div className="modal-backdrop">
            <motion.div
              className="card card-elevated turn-call-modal"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <div className="turn-pulse-icon">
                <BellRing size={48} color="#FFFFFF" />
              </div>

              <h1 className="text-h1" style={{ color: 'var(--deep-winter-blue)', margin: '16px 0 6px' }}>
                Your Turn Has Arrived!
              </h1>

              <div className="display-hero" style={{ fontSize: 52, margin: '8px 0' }}>
                {visit.tokenId}
              </div>

              <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>
                Please proceed immediately to Doctor Cabin for consultation with {visit.doctorId?.name}.
              </p>

              <button
                className="btn btn-primary btn-block"
                style={{ height: 48, fontSize: 16, marginTop: 24 }}
                onClick={() => setCalledModal(false)}
              >
                I Am Entering the Cabin <ArrowRight size={16} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cancel Confirmation Modal */}
      <AnimatePresence>
        {showCancelModal && (
          <div className="modal-backdrop">
            <motion.div
              className="card card-elevated modal-content"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <h2 className="text-h2">Cancel Queue Visit?</h2>
              <p className="text-muted" style={{ margin: '10px 0 20px', fontSize: 14 }}>
                Are you sure you want to cancel your visit and surrender Token #{visit.tokenId}? You will need to re-queue if you leave.
              </p>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setShowCancelModal(false)}
                >
                  Stay in Queue
                </button>
                <button
                  type="button"
                  className="btn btn-destructive"
                  style={{ flex: 1 }}
                  disabled={cancelling}
                  onClick={handleCancelVisit}
                >
                  {cancelling ? 'Cancelling...' : 'Yes, Leave Queue'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
