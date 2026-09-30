import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Calendar, CreditCard, XCircle, RefreshCw, AlertCircle, Copy, Check, X, CheckCircle2, Lock } from 'lucide-react';

export default function BookingsView({ onPayBooking, refreshTrigger }) {
  const { user, isAdmin } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [cancellingId, setCancellingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Quick Pay Modal State
  const [payingBooking, setPayingBooking] = useState(null);
  const [paySimMode, setPaySimMode] = useState('FORCE_SUCCESS');
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState(null);
  const [payReceipt, setPayReceipt] = useState(null);

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

  const handleOpenPayModal = (booking) => {
    setPayingBooking(booking);
    setPaySimMode('FORCE_SUCCESS');
    setPayError(null);
    setPayReceipt(null);
  };

  const handleExecutePayment = async () => {
    if (!payingBooking) return;
    setPayLoading(true);
    setPayError(null);

    const idempotencyKey = 'pay_quick_' + payingBooking.id + '_' + Date.now();
    const forceStatus = paySimMode === 'FORCE_FAILED' ? 'FAILED' : 'SUCCESS';

    try {
      const res = await api.createPayment({
        booking_id: payingBooking.id,
        idempotency_key: idempotencyKey,
        force_status: forceStatus,
      });

      if (forceStatus === 'FAILED' || res.status === 'FAILED') {
        setPayError('Payment Declined — The card was declined by issuing bank. Please switch simulation mode to Instant Success and try again.');
        await fetchBookings();
      } else {
        setPayReceipt({
          transaction_id: res.transaction_id,
          amount: payingBooking.amount,
          test_name: payingBooking.test_name,
          centre_name: payingBooking.centre_name,
        });
        await fetchBookings();
      }
    } catch (err) {
      setPayError(err.message || 'Payment execution failed.');
    } finally {
      setPayLoading(false);
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
            Confirmed
          </span>
        );
      case 'PENDING':
        return (
          <span className="pill-badge warning">
            Pending Payment
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="pill-badge error">
            Cancelled
          </span>
        );
      case 'FAILED':
        return (
          <span className="pill-badge error">
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
                            onClick={() => handleOpenPayModal(b)}
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--status-success-text)', fontWeight: 600 }}>
                            Paid & Confirmed
                          </span>
                          <button
                            onClick={() => handleCancel(b.id)}
                            disabled={cancellingId === b.id}
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--status-error-text)', fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                            title="Cancel appointment"
                          >
                            <XCircle size={13} />
                            Cancel
                          </button>
                        </div>
                      )}

                      {b.status === 'CANCELLED' && (
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                          Cancelled
                        </span>
                      )}

                      {b.status === 'FAILED' && (
                        <button
                          onClick={() => handleOpenPayModal(b)}
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

      {/* Quick Pay Modal for Pending Booking */}
      {payingBooking && (
        <div className="modal-backdrop" onClick={() => setPayingBooking(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '440px' }}
          >
            {/* Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                  Pay for Appointment
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Ref: #{payingBooking.id.substring(0, 8)}
                </span>
              </div>
              <button
                onClick={() => setPayingBooking(null)}
                className="btn btn-ghost btn-sm"
                style={{ padding: '0.25rem', border: 'none' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem' }}>
              {payReceipt ? (
                /* Success Receipt */
                <div>
                  <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: '#ECFDF5',
                      color: '#059669',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 0.5rem',
                    }}>
                      <CheckCircle2 size={24} />
                    </div>
                    <span className="pill-badge success" style={{ fontSize: '0.7rem' }}>PAID & CONFIRMED</span>
                    <h4 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0.35rem 0 0.15rem' }}>
                      Payment Successful
                    </h4>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                      Your booking has been marked as confirmed in database.
                    </p>
                  </div>

                  <div style={{
                    padding: '0.85rem',
                    backgroundColor: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    marginBottom: '1.25rem',
                    fontSize: '0.8125rem',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Test:</span>
                      <span style={{ fontWeight: 600 }}>{payReceipt.test_name}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Clinic:</span>
                      <span style={{ fontWeight: 600 }}>{payReceipt.centre_name}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Txn Reference:</span>
                      <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{payReceipt.transaction_id}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.35rem', borderTop: '1px solid var(--border-light)' }}>
                      <span style={{ fontWeight: 700 }}>Amount Paid:</span>
                      <span style={{ fontWeight: 800, fontSize: '1rem' }}>₹{parseFloat(payReceipt.amount).toFixed(2)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setPayingBooking(null)}
                    className="btn btn-ink"
                    style={{ width: '100%' }}
                  >
                    Done
                  </button>
                </div>
              ) : (
                /* Payment Checkout Form */
                <div>
                  {payError && (
                    <div style={{
                      padding: '0.65rem 0.85rem',
                      backgroundColor: 'var(--status-error-bg)',
                      border: '1px solid var(--status-error-border)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--status-error-text)',
                      fontSize: '0.8125rem',
                      marginBottom: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                    }}>
                      <XCircle size={15} />
                      <span>{payError}</span>
                    </div>
                  )}

                  {/* Summary Card */}
                  <div style={{
                    padding: '0.85rem',
                    backgroundColor: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    marginBottom: '1.25rem',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-main)' }}>
                          {payingBooking.test_name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                          {payingBooking.centre_name} · {payingBooking.centre_location}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Amount</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                          ₹{parseFloat(payingBooking.amount).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Simulation Toggle */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 500 }}>
                      Payment Simulation Mode
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                      <button
                        type="button"
                        onClick={() => setPaySimMode('FORCE_SUCCESS')}
                        style={{
                          padding: '0.4rem',
                          fontSize: '0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          border: paySimMode === 'FORCE_SUCCESS' ? '1px solid var(--text-main)' : '1px solid var(--border-light)',
                          backgroundColor: paySimMode === 'FORCE_SUCCESS' ? 'var(--text-main)' : '#FFFFFF',
                          color: paySimMode === 'FORCE_SUCCESS' ? '#FFFFFF' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontWeight: paySimMode === 'FORCE_SUCCESS' ? 600 : 400,
                        }}
                      >
                        Instant Success
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaySimMode('FORCE_FAILED')}
                        style={{
                          padding: '0.4rem',
                          fontSize: '0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          border: paySimMode === 'FORCE_FAILED' ? '1px solid var(--status-error-border)' : '1px solid var(--border-light)',
                          backgroundColor: paySimMode === 'FORCE_FAILED' ? 'var(--status-error-bg)' : '#FFFFFF',
                          color: paySimMode === 'FORCE_FAILED' ? 'var(--status-error-text)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontWeight: paySimMode === 'FORCE_FAILED' ? 600 : 400,
                        }}
                      >
                        Simulate Decline
                      </button>
                    </div>
                  </div>

                  {/* Pay button */}
                  <button
                    type="button"
                    onClick={handleExecutePayment}
                    disabled={payLoading}
                    className="btn btn-ink"
                    style={{ width: '100%', height: '40px', fontSize: '0.875rem' }}
                  >
                    {payLoading ? (
                      <>
                        <RefreshCw size={13} className="pulse" />
                        Processing Payment...
                      </>
                    ) : (
                      <>
                        Pay ₹{parseFloat(payingBooking.amount).toFixed(2)} →
                      </>
                    )}
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', marginTop: '0.65rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    <Lock size={10} />
                    <span>256-bit encrypted simulated processing</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
