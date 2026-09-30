import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Calendar, Clock, CreditCard, XCircle, CheckCircle, RefreshCw, AlertCircle, ArrowRight, Shield, Copy, Check } from 'lucide-react';

export default function BookingsView({ onPayBooking, onOpenWebhook, refreshTrigger }) {
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
      setError(err.message || 'Failed to fetch bookings ledger.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [refreshTrigger]);

  const handleCancel = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this diagnostic booking?')) {
      return;
    }
    setCancellingId(bookingId);
    try {
      await api.cancelBooking(bookingId);
      await fetchBookings();
    } catch (err) {
      alert(err.message || 'Failed to cancel booking.');
    } finally {
      setCancellingId(null);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const statuses = ['ALL', 'PENDING', 'CONFIRMED', 'CANCELLED', 'FAILED'];

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
            CONFIRMED
          </span>
        );
      case 'PENDING':
        return (
          <span className="pill-badge warning">
            <span className="dot amber pulse"></span>
            PENDING
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="pill-badge error">
            <span className="dot rose"></span>
            CANCELLED
          </span>
        );
      case 'FAILED':
        return (
          <span className="pill-badge error">
            <span className="dot rose"></span>
            FAILED
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
        marginBottom: '1.5rem',
      }}>
        <div>
          <div className="kicker">// 02 STATE MACHINE & AUDIT LEDGER</div>
          <h2 style={{ fontSize: '1.5rem', marginTop: '0.2rem' }}>
            Diagnostic Bookings Ledger
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            {isAdmin ? (
              <span style={{ color: 'var(--status-warning-text)', fontWeight: 500 }}>
                🛡️ AUDIT MODE: Viewing all bookings across all patients in the system.
              </span>
            ) : (
              'Viewing your personal appointment records with immutable price snapshots.'
            )}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={fetchBookings}
            disabled={loading}
            className="btn btn-ghost btn-sm"
          >
            <RefreshCw size={12} className={loading ? 'pulse' : ''} />
            Refresh Ledger
          </button>
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="card" style={{ padding: '0.75rem 1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginRight: '0.5rem' }}>
            STATUS FILTER:
          </span>
          {statuses.map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                padding: '0.2rem 0.65rem',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
                borderRadius: 'var(--radius-full)',
                border: statusFilter === st ? '1px solid var(--border-strong)' : '1px solid var(--border-light)',
                backgroundColor: statusFilter === st ? 'var(--bg-dark)' : 'transparent',
                color: statusFilter === st ? 'var(--text-inverse)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.1s ease',
              }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Ledger Table */}
      {loading ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <RefreshCw size={24} className="pulse" style={{ margin: '0 auto 0.75rem', color: 'var(--text-muted)' }} />
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Loading bookings from database...</div>
        </div>
      ) : error ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', borderColor: 'var(--status-error-border)' }}>
          <AlertCircle size={24} style={{ margin: '0 auto 0.5rem', color: 'var(--status-error-text)' }} />
          <div style={{ color: 'var(--status-error-text)', fontSize: '0.875rem' }}>{error}</div>
          <button onClick={fetchBookings} className="btn btn-ghost btn-sm" style={{ marginTop: '1rem' }}>
            Retry Request
          </button>
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="card" style={{ padding: '3.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            No bookings found matching filter: {statusFilter}.
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            Head over to the Catalog Matrix to schedule an appointment.
          </p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Booking Reference</th>
                <th>Diagnostic Test</th>
                <th>Diagnostic Centre</th>
                <th>Appointment Schedule</th>
                <th>Amount (Frozen)</th>
                <th>State Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.map((b) => (
                <tr key={b.id}>
                  {/* Reference ID */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 600 }}>
                        {b.id.substring(0, 8)}...
                      </span>
                      <button
                        onClick={() => copyToClipboard(b.id, b.id)}
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '0.15rem 0.3rem', height: '20px' }}
                        title="Copy full UUID"
                      >
                        {copiedId === b.id ? <Check size={11} color="var(--status-success-text)" /> : <Copy size={11} />}
                      </button>
                    </div>
                    {isAdmin && b.patient_name && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        Patient: {b.patient_name}
                      </div>
                    )}
                  </td>

                  {/* Test */}
                  <td>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      {b.test_name || 'Diagnostic Test'}
                    </div>
                    {b.notes && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.15rem' }}>
                        Note: {b.notes}
                      </div>
                    )}
                  </td>

                  {/* Centre */}
                  <td>
                    <div style={{ fontSize: '0.85rem' }}>{b.centre_name || 'Medical Hub'}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{b.centre_location}</div>
                  </td>

                  {/* Appointment Time */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8125rem' }}>
                      <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                      <span>{formatDateTime(b.appointment_time)}</span>
                    </div>
                  </td>

                  {/* Amount Snapshot */}
                  <td>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.9rem' }}>
                      ₹{parseFloat(b.amount).toFixed(2)}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      AUDIT FROZEN
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
                            style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
                          >
                            <CreditCard size={12} />
                            Pay Now
                          </button>
                          <button
                            onClick={() => handleCancel(b.id)}
                            disabled={cancellingId === b.id}
                            className="btn btn-danger btn-sm"
                            style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem' }}
                            title="Cancel appointment (State Machine: PENDING -> CANCELLED)"
                          >
                            <XCircle size={12} />
                            Cancel
                          </button>
                        </>
                      )}

                      {b.status === 'CONFIRMED' && (
                        <>
                          <span style={{ fontSize: '0.75rem', color: 'var(--status-success-text)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                            ✓ PAID & CONFIRMED
                          </span>
                          <button
                            onClick={() => onOpenWebhook && onOpenWebhook(b)}
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}
                            title="Open Webhook Sandbox with this Booking ID"
                          >
                            Test Webhook
                          </button>
                        </>
                      )}

                      {(b.status === 'CANCELLED' || b.status === 'FAILED') && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)', fontStyle: 'italic' }}>
                          Terminal State
                        </span>
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
