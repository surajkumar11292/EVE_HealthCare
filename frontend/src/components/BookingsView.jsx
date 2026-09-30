import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Calendar, CreditCard, XCircle, RefreshCw, AlertCircle, Copy, Check } from 'lucide-react';

export default function BookingsView({ onPayBooking, refreshTrigger }) {
  const { user, isAdmin } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [cancellingId, setCancellingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const fetchBookings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getBookings({ size: 50 });
      setBookings(data.items || []);
    } catch (err) {
      setError(err.message || 'Unable to load appointment records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [refreshTrigger]);

  const handleCancel = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) {
      return;
    }
    setCancellingId(bookingId);
    try {
      await api.cancelBooking(bookingId);
      await fetchBookings();
    } catch (err) {
      alert(err.message || 'Failed to cancel appointment.');
    } finally {
      setCancellingId(null);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const statusOptions = [
    { id: 'ALL', label: 'All Appointments' },
    { id: 'PENDING', label: 'Pending Payment' },
    { id: 'CONFIRMED', label: 'Confirmed' },
    { id: 'CANCELLED', label: 'Cancelled' },
    { id: 'FAILED', label: 'Failed' },
  ];

  const filteredBookings = bookings.filter((b) => {
    if (statusFilter === 'ALL') return true;
    return b.status === statusFilter;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <span className="pill-badge success">
            <span className="dot green"></span>
            Confirmed
          </span>
        );
      case 'PENDING':
        return (
          <span className="pill-badge warning">
            <span className="dot amber"></span>
            Pending Payment
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="pill-badge error">
            <span className="dot rose"></span>
            Cancelled
          </span>
        );
      case 'FAILED':
        return (
          <span className="pill-badge error">
            <span className="dot rose"></span>
            Payment Failed
          </span>
        );
      default:
        return (
          <span className="pill-badge neutral">
            {status}
          </span>
        );
    }
  };

  const formatDateTime = (isoString) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text-main)' }}>
            {isAdmin ? 'All Patient Appointments' : 'My Appointments'}
          </h1>
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            {isAdmin
              ? 'Administrator overview of all diagnostic bookings scheduled across the platform.'
              : 'Review your upcoming diagnostic tests, check appointment times, and complete payment.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={fetchBookings}
            disabled={loading}
            className="btn btn-ghost btn-sm"
          >
            <RefreshCw size={13} className={loading ? 'pulse' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div className="impeccable-pill-bar">
          {statusOptions.map((opt) => {
            const isSelected = statusFilter === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setStatusFilter(opt.id)}
                className={`impeccable-pill-btn ${isSelected ? 'active' : ''}`}
              >
                {isSelected && <span className="dot green"></span>}
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bookings Content */}
      {loading ? (
        <div className="card" style={{ padding: '3.5rem', textAlign: 'center' }}>
          <RefreshCw size={24} className="pulse" style={{ margin: '0 auto 0.75rem', color: 'var(--text-muted)' }} />
          <div style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>Loading appointment details...</div>
        </div>
      ) : error ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', borderColor: 'var(--status-error-border)' }}>
          <AlertCircle size={24} style={{ margin: '0 auto 0.5rem', color: 'var(--status-error-text)' }} />
          <div style={{ color: 'var(--status-error-text)', fontSize: '0.9375rem' }}>{error}</div>
          <button onClick={fetchBookings} className="btn btn-ghost btn-sm" style={{ marginTop: '1rem' }}>
            Try Again
          </button>
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="card" style={{ padding: '3.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
            No appointments found
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            There are no appointments with status "{statusOptions.find(o => o.id === statusFilter)?.label}".
          </p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Test Details</th>
                <th>Diagnostic Lab</th>
                <th>Appointment Date & Time</th>
                <th>Price</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.map((b) => (
                <tr key={b.id}>
                  {/* Reference ID */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        #{b.id.substring(0, 8)}
                      </span>
                      <button
                        onClick={() => copyToClipboard(b.id, b.id)}
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '0.15rem 0.35rem', height: '22px' }}
                        title="Copy full Booking Reference"
                      >
                        {copiedId === b.id ? <Check size={12} color="var(--status-success-dot)" /> : <Copy size={12} />}
                      </button>
                    </div>
                    {isAdmin && b.patient_name && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        Patient: {b.patient_name}
                      </div>
                    )}
                  </td>

                  {/* Test */}
                  <td>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                      {b.test_name || 'Diagnostic Evaluation'}
                    </div>
                    {b.notes && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        Notes: {b.notes}
                      </div>
                    )}
                  </td>

                  {/* Centre */}
                  <td>
                    <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{b.centre_name || 'Partner Lab'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.centre_location}</div>
                  </td>

                  {/* Appointment Time */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem' }}>
                      <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                      <span>{formatDateTime(b.appointment_time)}</span>
                    </div>
                  </td>

                  {/* Amount */}
                  <td>
                    <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-main)' }}>
                      ₹{parseFloat(b.amount).toFixed(2)}
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td>
                    {getStatusBadge(b.status)}
                  </td>

                  {/* Actions */}
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      {b.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => onPayBooking && onPayBooking(b)}
                            className="btn btn-ink btn-sm"
                          >
                            <CreditCard size={13} />
                            Pay Now
                          </button>
                          <button
                            onClick={() => handleCancel(b.id)}
                            disabled={cancellingId === b.id}
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--status-error-text)' }}
                          >
                            <XCircle size={13} />
                            Cancel
                          </button>
                        </>
                      )}

                      {b.status === 'CONFIRMED' && (
                        <span style={{ fontSize: '0.8125rem', color: 'var(--status-success-text)', fontWeight: 600 }}>
                          Ready for Visit
                        </span>
                      )}

                      {b.status === 'CANCELLED' && (
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                          Cancelled
                        </span>
                      )}

                      {b.status === 'FAILED' && (
                        <button
                          onClick={() => onPayBooking && onPayBooking(b)}
                          className="btn btn-ghost btn-sm"
                        >
                          Retry Payment
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
