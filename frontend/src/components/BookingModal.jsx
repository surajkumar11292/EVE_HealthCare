import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { X, Calendar, Clock, AlertCircle, CheckCircle2, ArrowRight, Sun, Moon } from 'lucide-react';

const MORNING_SLOTS = [
  { label: '08:00 AM', hour: 8, minute: 0 },
  { label: '09:00 AM', hour: 9, minute: 0 },
  { label: '10:00 AM', hour: 10, minute: 0 },
  { label: '11:00 AM', hour: 11, minute: 0 },
];

const AFTERNOON_SLOTS = [
  { label: '02:00 PM', hour: 14, minute: 0 },
  { label: '03:30 PM', hour: 15, minute: 30 },
  { label: '04:30 PM', hour: 16, minute: 30 },
  { label: '06:00 PM', hour: 18, minute: 0 },
];

export default function BookingModal({ isOpen, onClose, centre, centreTest, onBookingCreated }) {
  const { isAuthenticated, user } = useAuth();

  // Helper to format date as YYYY-MM-DD
  const formatDateISO = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Build quick day options (Tomorrow, In 2 Days, In 3 Days, In 4 Days)
  const getUpcomingDays = () => {
    const days = [];
    for (let i = 1; i <= 4; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const isTomorrow = i === 1;
      const dayLabel = isTomorrow
        ? 'Tomorrow'
        : d.toLocaleDateString('en-US', { weekday: 'short' });
      const dateFormatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      days.push({
        iso: formatDateISO(d),
        label: `${dayLabel}, ${dateFormatted}`,
        fullLabel: d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }),
      });
    }
    return days;
  };

  const upcomingDays = getUpcomingDays();

  const [selectedDate, setSelectedDate] = useState(upcomingDays[0].iso);
  const [selectedSlot, setSelectedSlot] = useState(MORNING_SLOTS[2]); // Default 10:00 AM
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      const days = getUpcomingDays();
      setSelectedDate(days[0].iso);
      setSelectedSlot(MORNING_SLOTS[2]);
      setNotes('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen || !centre || !centreTest) return null;

  // Compute readable selected datetime summary
  const getReadableSummary = () => {
    if (!selectedDate || !selectedSlot) return '';
    try {
      const [year, month, day] = selectedDate.split('-').map(Number);
      const d = new Date(year, month - 1, day, selectedSlot.hour, selectedSlot.minute);
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }) + ` at ${selectedSlot.label}`;
    } catch {
      return `${selectedDate} at ${selectedSlot.label}`;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!selectedDate || !selectedSlot) {
        throw new Error('Please select both an appointment date and an available time slot.');
      }

      const [year, month, day] = selectedDate.split('-').map(Number);
      const appointmentDateTime = new Date(year, month - 1, day, selectedSlot.hour, selectedSlot.minute, 0);

      if (appointmentDateTime <= new Date()) {
        throw new Error('Appointment date and time must be in the future.');
      }

      const payload = {
        centre_test_id: centreTest.id,
        appointment_time: appointmentDateTime.toISOString(),
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

  const todayStr = formatDateISO(new Date());

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
              Schedule Diagnostic Appointment
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.15rem', margin: 0 }}>
              Select your preferred lab visit date and time slot
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ padding: '0.25rem', border: 'none' }}
          >
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
            padding: '0.9rem 1rem',
            backgroundColor: 'var(--bg-subtle)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)',
            marginBottom: '1.25rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="pill-badge neutral" style={{ fontSize: '0.65rem', marginBottom: '0.25rem' }}>
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
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Payable Fee
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  ₹{parseFloat(centreTest.price).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* 1. Date Selection Section */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
              <Calendar size={14} color="var(--accent-gold)" />
              <span>1. Choose Appointment Date</span>
            </label>

            {/* Quick Date Pills */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.5rem',
              marginBottom: '0.5rem',
            }}>
              {upcomingDays.map((d) => {
                const isSelected = selectedDate === d.iso;
                return (
                  <button
                    key={d.iso}
                    type="button"
                    onClick={() => setSelectedDate(d.iso)}
                    style={{
                      padding: '0.55rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      border: isSelected ? '1.5px solid var(--text-main)' : '1px solid var(--border-light)',
                      backgroundColor: isSelected ? '#FFFFFF' : 'var(--bg-subtle)',
                      boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '0.8125rem',
                      fontWeight: isSelected ? 600 : 500,
                      color: isSelected ? 'var(--text-main)' : 'var(--text-secondary)',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>{d.label}</span>
                    {isSelected && <CheckCircle2 size={13} color="var(--accent-gold)" />}
                  </button>
                );
              })}
            </div>

            {/* Or custom date picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Or choose other date:</span>
              <input
                type="date"
                min={todayStr}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="form-input"
                style={{ fontSize: '0.8125rem', padding: '0.35rem 0.6rem', width: 'auto' }}
              />
            </div>
          </div>

          {/* 2. Time Slot Selection Section with Explicit AM/PM */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
              <Clock size={14} color="var(--accent-gold)" />
              <span>2. Choose Time Slot (AM / PM)</span>
            </label>

            {/* Morning Slots */}
            <div style={{ marginBottom: '0.65rem' }}>
              <div style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--text-muted)',
                marginBottom: '0.35rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}>
                <Sun size={12} color="#D97706" />
                Morning Slots (AM)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.45rem' }}>
                {MORNING_SLOTS.map((slot) => {
                  const isSelected = selectedSlot.label === slot.label;
                  return (
                    <button
                      key={slot.label}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      style={{
                        padding: '0.5rem 0.25rem',
                        borderRadius: 'var(--radius-md)',
                        border: isSelected ? '1.5px solid var(--text-main)' : '1px solid var(--border-light)',
                        backgroundColor: isSelected ? 'var(--text-main)' : '#FFFFFF',
                        color: isSelected ? '#FFFFFF' : 'var(--text-main)',
                        fontWeight: isSelected ? 600 : 500,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {slot.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Afternoon & Evening Slots */}
            <div>
              <div style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--text-muted)',
                marginBottom: '0.35rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}>
                <Moon size={12} color="#6366F1" />
                Afternoon & Evening Slots (PM)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.45rem' }}>
                {AFTERNOON_SLOTS.map((slot) => {
                  const isSelected = selectedSlot.label === slot.label;
                  return (
                    <button
                      key={slot.label}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      style={{
                        padding: '0.5rem 0.25rem',
                        borderRadius: 'var(--radius-md)',
                        border: isSelected ? '1.5px solid var(--text-main)' : '1px solid var(--border-light)',
                        backgroundColor: isSelected ? 'var(--text-main)' : '#FFFFFF',
                        color: isSelected ? '#FFFFFF' : 'var(--text-main)',
                        fontWeight: isSelected ? 600 : 500,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {slot.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3. Selected Slot Confirmation Banner */}
          <div style={{
            padding: '0.65rem 0.85rem',
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <CheckCircle2 size={16} color="#059669" />
            <div style={{ fontSize: '0.8125rem', color: '#065F46' }}>
              <strong>Selected Appointment:</strong> {getReadableSummary()}
            </div>
          </div>

          {/* Clinical Notes (Optional) */}
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Notes for Laboratory (Optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 10 hours overnight fasting completed, allergic to iodine"
              className="form-textarea"
              style={{ fontSize: '0.8125rem' }}
            />
          </div>

          {/* Confirm Button */}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-ink"
            style={{ width: '100%', padding: '0.75rem', fontSize: '0.875rem' }}
          >
            {loading ? 'Confirming Appointment...' : 'Confirm Appointment'}
            <span className="arrow-gold">→</span>
          </button>
        </form>
      </div>
    </div>
  );
}
