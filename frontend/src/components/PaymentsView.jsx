import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { CreditCard, CheckCircle2, XCircle, RefreshCw, Key, ShieldCheck, AlertCircle, ArrowRight, Lock, Check } from 'lucide-react';

export default function PaymentsView({ initialBooking, onPaymentSuccess }) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [selectedBookingId, setSelectedBookingId] = useState(initialBooking?.id || '');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [simulationMode, setSimulationMode] = useState('FORCE_SUCCESS'); // Default to clean success for normal user experience
  const [loading, setLoading] = useState(false);
  const [lastPaymentResult, setLastPaymentResult] = useState(null);
  const [error, setError] = useState(null);

  const generateIdempotencyKey = () => {
    const key = 'pay_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    setIdempotencyKey(key);
  };

  useEffect(() => {
    generateIdempotencyKey();
  }, []);

  const fetchBookings = async () => {
    try {
      const data = await api.getBookings({ size: 50 });
      const items = data.items || [];
      setBookings(items);

      if (initialBooking) {
        setSelectedBookingId(initialBooking.id);
      } else if (items.length > 0) {
        const pending = items.find((b) => b.status === 'PENDING');
        if (pending) {
          setSelectedBookingId(pending.id);
        } else {
          setSelectedBookingId(items[0].id);
        }
      }
    } catch (err) {
      console.warn('Failed to load bookings for payment:', err);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [initialBooking]);

  const selectedBooking = bookings.find((b) => b.id === selectedBookingId);

  const handleProcessPayment = async (overrideKey = null) => {
    if (!selectedBookingId) {
      setError('Please select an appointment to pay for.');
      return;
    }

    setLoading(true);
    setError(null);

    const keyToUse = overrideKey || idempotencyKey;

    let forceStatus = null;
    if (simulationMode === 'FORCE_SUCCESS') forceStatus = 'SUCCESS';
    if (simulationMode === 'FORCE_FAILED') forceStatus = 'FAILED';

    try {
      const payload = {
        booking_id: selectedBookingId,
        idempotency_key: keyToUse,
        force_status: forceStatus,
      };

      const result = await api.createPayment(payload);
      setLastPaymentResult({
        ...result,
        replayed: !!overrideKey,
      });

      await fetchBookings();
      if (onPaymentSuccess) {
        onPaymentSuccess(result);
      }
    } catch (err) {
      setError(err.message || 'Payment could not be completed. Please try again.');
    } finally {
      setLoading(false);
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
            Pay Online
          </h1>
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Complete secure payment for your scheduled diagnostic checkup.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
        {/* Left: Checkout Box */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CreditCard size={18} />
            Checkout & Confirmation
          </h2>

          {error && (
            <div style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--status-error-bg)',
              border: '1px solid var(--status-error-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--status-error-text)',
              fontSize: '0.875rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {/* Select Appointment */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Select Appointment</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {bookings.filter((b) => b.status === 'PENDING').length} pending payment
              </span>
            </label>
            <select
              value={selectedBookingId}
              onChange={(e) => {
                setSelectedBookingId(e.target.value);
                setError(null);
                setLastPaymentResult(null);
              }}
              className="form-select"
              style={{ fontSize: '0.875rem' }}
            >
              {bookings.length === 0 ? (
                <option value="">No appointments scheduled yet</option>
              ) : (
                bookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.test_name} at {b.centre_name} — ₹{parseFloat(b.amount).toFixed(2)} ({b.status})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Selected Booking Details Card */}
          {selectedBooking && (
            <div style={{
              padding: '1.25rem',
              backgroundColor: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-light)',
              marginBottom: '1.5rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-main)' }}>
                    {selectedBooking.test_name}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                    {selectedBooking.centre_name} · {selectedBooking.centre_location}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Total Payable
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    ₹{parseFloat(selectedBooking.amount).toFixed(2)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-light)', paddingTop: '0.65rem', marginTop: '0.65rem', fontSize: '0.8125rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                <span className={`pill-badge ${selectedBooking.status === 'CONFIRMED' ? 'success' : selectedBooking.status === 'PENDING' ? 'warning' : 'error'}`}>
                  <span className={`dot ${selectedBooking.status === 'CONFIRMED' ? 'green' : selectedBooking.status === 'PENDING' ? 'amber' : 'rose'}`}></span>
                  {selectedBooking.status === 'CONFIRMED' ? 'Paid & Confirmed' : selectedBooking.status === 'PENDING' ? 'Pending Payment' : selectedBooking.status}
                </span>
              </div>
            </div>
          )}

          {/* Payment Simulation Options */}
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Payment Simulation Option</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setSimulationMode('FORCE_SUCCESS')}
                style={{
                  padding: '0.6rem',
                  fontSize: '0.8125rem',
                  borderRadius: 'var(--radius-md)',
                  border: simulationMode === 'FORCE_SUCCESS' ? '1px solid var(--text-main)' : '1px solid var(--border-light)',
                  backgroundColor: simulationMode === 'FORCE_SUCCESS' ? 'var(--text-main)' : 'var(--bg-surface)',
                  color: simulationMode === 'FORCE_SUCCESS' ? '#FFFFFF' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: simulationMode === 'FORCE_SUCCESS' ? 600 : 400,
                  textAlign: 'center',
                }}
              >
                Instant Success (Standard)
              </button>

              <button
                type="button"
                onClick={() => setSimulationMode('FORCE_FAILED')}
                style={{
                  padding: '0.6rem',
                  fontSize: '0.8125rem',
                  borderRadius: 'var(--radius-md)',
                  border: simulationMode === 'FORCE_FAILED' ? '1px solid var(--status-error-border)' : '1px solid var(--border-light)',
                  backgroundColor: simulationMode === 'FORCE_FAILED' ? 'var(--status-error-bg)' : 'var(--bg-surface)',
                  color: simulationMode === 'FORCE_FAILED' ? 'var(--status-error-text)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: simulationMode === 'FORCE_FAILED' ? 600 : 400,
                  textAlign: 'center',
                }}
              >
                Simulate Declined Card
              </button>
            </div>
          </div>

          {/* Submit Action */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={() => handleProcessPayment()}
              disabled={loading || !selectedBookingId || selectedBooking?.status === 'CONFIRMED'}
              className="btn btn-ink"
              style={{ width: '100%', padding: '0.75rem' }}
            >
              {loading ? (
                <>
                  <RefreshCw size={14} className="pulse" />
                  Processing Payment...
                </>
              ) : selectedBooking?.status === 'CONFIRMED' ? (
                'Appointment Already Paid'
              ) : (
                <>
                  {`Complete Payment (₹${selectedBooking ? parseFloat(selectedBooking.amount).toFixed(2) : '0.00'})`}
                  <span className="arrow-gold">→</span>
                </>
              )}
            </button>

            {lastPaymentResult && (
              <button
                type="button"
                onClick={() => handleProcessPayment(lastPaymentResult.idempotency_key)}
                disabled={loading}
                className="btn btn-ghost"
                style={{ width: '100%', fontSize: '0.8125rem' }}
                title="Test safety against double-charging by resending identical key"
              >
                <ShieldCheck size={14} />
                Re-submit with same key (Test double-spend prevention)
              </button>
            )}
          </div>
        </div>

        {/* Right: Payment Receipt */}
        <div>
          <div className="card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1.25rem' }}>
              Payment Receipt
            </h2>

            {!lastPaymentResult ? (
              <div style={{
                padding: '3rem 1.5rem',
                textAlign: 'center',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-muted)',
                fontSize: '0.875rem',
              }}>
                <CreditCard size={32} style={{ opacity: 0.3, margin: '0 auto 0.75rem' }} />
                <div>No payment initiated yet.</div>
                <div style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                  Select an appointment on the left and click "Complete Payment" to generate your receipt.
                </div>
              </div>
            ) : (
              <div style={{
                padding: '1.5rem',
                backgroundColor: lastPaymentResult.status === 'SUCCESS' ? 'var(--status-success-bg)' : 'var(--status-error-bg)',
                border: `1px solid ${lastPaymentResult.status === 'SUCCESS' ? 'var(--status-success-border)' : 'var(--status-error-border)'}`,
                borderRadius: 'var(--radius-md)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {lastPaymentResult.status === 'SUCCESS' ? (
                      <CheckCircle2 size={20} color="var(--status-success-dot)" />
                    ) : (
                      <XCircle size={20} color="var(--status-error-dot)" />
                    )}
                    <span style={{ fontWeight: 700, fontSize: '1rem', color: lastPaymentResult.status === 'SUCCESS' ? 'var(--status-success-text)' : 'var(--status-error-text)' }}>
                      {lastPaymentResult.status === 'SUCCESS' ? 'Payment Confirmed' : 'Payment Failed'}
                    </span>
                  </div>

                  {lastPaymentResult.replayed && (
                    <span className="pill-badge neutral" style={{ backgroundColor: '#FFFFFF', fontSize: '0.7rem' }}>
                      Duplicate Safely Blocked
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', fontSize: '0.875rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Transaction Reference</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{lastPaymentResult.transaction_id}</span>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Amount Paid</span>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-main)' }}>
                      ₹{parseFloat(lastPaymentResult.amount).toFixed(2)}
                    </span>
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Payment Token</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {lastPaymentResult.idempotency_key}
                    </span>
                  </div>

                  {lastPaymentResult.failure_reason && (
                    <div style={{ gridColumn: 'span 2', color: 'var(--status-error-text)', fontSize: '0.8125rem' }}>
                      Reason: {lastPaymentResult.failure_reason}
                    </div>
                  )}
                </div>

                <div style={{
                  marginTop: '1.25rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid rgba(0,0,0,0.06)',
                  fontSize: '0.8125rem',
                  color: 'var(--text-secondary)',
                }}>
                  {lastPaymentResult.status === 'SUCCESS'
                    ? '✓ Your appointment has been confirmed. You will receive an SMS and email reminder.'
                    : '✕ The card was declined. Please try again or select another payment option.'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
