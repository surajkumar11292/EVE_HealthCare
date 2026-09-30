import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { X, Calendar, Clock, Lock, AlertCircle, ArrowRight } from 'lucide-react';

export default function BookingModal({ isOpen, onClose, centre, centreTest, onBookingCreated }) {
  const { isAuthenticated, user } = useAuth();

  const getDefaultDatetime = (daysAhead = 1, hour = 10) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    d.setHours(hour, 0, 0, 0);
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().slice(0, 16);
  };

  const [appointmentTime, setAppointmentTime] = useState(getDefaultDatetime(1, 10));
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setAppointmentTime(getDefaultDatetime(1, 10));
      setNotes('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen || !centre || !centreTest) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const selectedDate = new Date(appointmentTime);
      if (selectedDate <= new Date()) {
        throw new Error('Appointment date and time must be in the future.');
      }

      const payload = {
        centre_test_id: centreTest.id,
        appointment_time: selectedDate.toISOString(),
        notes: notes.trim() || null,
      };

      const booking = await api.createBooking(payload);
      onBookingCreated(booking);
      onClose();
    } catch (err) {
      setError(err.message || 'Unable to schedule appointment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-main)' }}>
              Schedule Appointment
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
              Confirm your diagnostic test details and timing
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: '0.25rem' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {error && (
            <div style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--status-error-bg)',
              border: '1px solid var(--status-error-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--status-error-text)',
              fontSize: '0.8125rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {/* Test & Lab Overview */}
          <div style={{
            padding: '1rem',
            backgroundColor: 'var(--bg-subtle)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)',
            marginBottom: '1.25rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="pill-badge neutral" style={{ fontSize: '0.65rem', marginBottom: '0.35rem' }}>
                  {centreTest.test?.category || 'General'}
                </span>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-main)' }}>
                  {centreTest.test?.name}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                  {centre.name} · {centre.location}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Price
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  ₹{parseFloat(centreTest.price).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Appointment Time */}
          <div className="form-group">
            <label className="form-label">Select Date & Time</label>
            <input
              type="datetime-local"
              required
              value={appointmentTime}
              onChange={(e) => setAppointmentTime(e.target.value)}
              className="form-input"
            />

            {/* Quick Presets */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setAppointmentTime(getDefaultDatetime(1, 10))}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
              >
                Tomorrow 10 AM
              </button>
              <button
                type="button"
                onClick={() => setAppointmentTime(getDefaultDatetime(2, 9))}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
              >
                In 2 Days 9 AM
              </button>
              <button
                type="button"
                onClick={() => setAppointmentTime(getDefaultDatetime(5, 11))}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
              >
                In 5 Days 11 AM
              </button>
            </div>
          </div>

          {/* Clinical Notes */}
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Notes for Laboratory (Optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 10 hours overnight fasting completed"
              className="form-textarea"
              style={{ fontSize: '0.8125rem' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-ink"
            style={{ width: '100%', padding: '0.7rem' }}
          >
            {loading ? 'Booking Appointment...' : 'Confirm Appointment'}
            <span className="arrow-gold">→</span>
          </button>
        </form>
      </div>
    </div>
  );
}
