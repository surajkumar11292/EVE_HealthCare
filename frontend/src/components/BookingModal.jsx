import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { X, Calendar, Clock, Lock, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function BookingModal({ isOpen, onClose, centre, centreTest, onBookingCreated }) {
  const { isAuthenticated, user } = useAuth();

  // Helper to format ISO datetime-local string in local timezone
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
      // Convert datetime-local to ISO string with timezone
      const selectedDate = new Date(appointmentTime);
      if (selectedDate <= new Date()) {
        throw new Error('Appointment date and time must be strictly in the future.');
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
      setError(err.message || 'Failed to create booking.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div className="kicker">// 02 APPOINTMENT SCHEDULER</div>
            <h3 style={{ fontSize: '1.2rem', marginTop: '0.15rem' }}>
              Book Diagnostic Appointment
            </h3>
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
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* Test & Lab Summary Card */}
          <div style={{
            padding: '1rem',
            backgroundColor: 'var(--bg-subtle)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)',
            marginBottom: '1.25rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <div>
                <span className="pill-badge neutral" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', marginBottom: '0.25rem' }}>
                  {centreTest.test?.category || 'Diagnostic'}
                </span>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                  {centreTest.test?.name}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  {centre.name} · {centre.location}
                </div>
              </div>

              {/* Price Snapshot Display */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  IMMUTABLE PRICE
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                  ₹{parseFloat(centreTest.price).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Explanatory Callout */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              borderTop: '1px dashed var(--border-subtle)',
              paddingTop: '0.5rem',
              marginTop: '0.5rem',
            }}>
              <Lock size={11} />
              <span>Price is snapshotted into bookings.amount at booking creation.</span>
            </div>
          </div>

          {/* Appointment Time Selection */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Appointment Date & Time</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Future time required</span>
            </label>
            <input
              type="datetime-local"
              required
              value={appointmentTime}
              onChange={(e) => setAppointmentTime(e.target.value)}
              className="form-input"
              style={{ fontFamily: 'var(--font-mono)' }}
            />

            {/* Quick Preset Buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setAppointmentTime(getDefaultDatetime(1, 10))}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
              >
                Tomorrow 10:00 AM
              </button>
              <button
                type="button"
                onClick={() => setAppointmentTime(getDefaultDatetime(2, 9))}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
              >
                In 2 Days 09:00 AM
              </button>
              <button
                type="button"
                onClick={() => setAppointmentTime(getDefaultDatetime(5, 11))}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
              >
                In 5 Days 11:00 AM
              </button>
            </div>
          </div>

          {/* Clinical Notes */}
          <div className="form-group">
            <label className="form-label">Clinical Notes / Fasting Requirements (Optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 10 hours overnight fasting completed; routine checkup"
              className="form-textarea"
              style={{ fontSize: '0.8125rem' }}
            />
          </div>

          {/* Patient Identity Confirmation */}
          <div style={{
            fontSize: '0.75rem',
            padding: '0.65rem 0.85rem',
            backgroundColor: 'var(--bg-canvas)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ color: 'var(--text-muted)' }}>PATIENT:</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              {user ? `${user.full_name} (${user.email})` : 'Unauthenticated Session'}
            </span>
          </div>

          {/* Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-ink"
            style={{ width: '100%' }}
          >
            {loading ? 'Creating Immutable Booking...' : 'Confirm Appointment'}
            <ArrowRight size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}
