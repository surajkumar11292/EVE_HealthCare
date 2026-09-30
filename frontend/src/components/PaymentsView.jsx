import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { CreditCard, CheckCircle2, XCircle, RefreshCw, Lock, ShieldCheck, FileText } from 'lucide-react';

export default function PaymentsView({ initialBooking, onPaymentSuccess }) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [selectedBookingId, setSelectedBookingId] = useState(initialBooking?.id || '');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [simulationMode, setSimulationMode] = useState('FORCE_SUCCESS');
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

  const pendingCount = bookings.filter((b) => b.status === 'PENDING').length;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      {/* Compact Page Header (Fit in 1 page without scrolling) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1rem',
      }}>
        <div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text-main)', margin: 0 }}>
            Pay Online
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0' }}>
            Instant payment checkout for your scheduled diagnostic appointments.
          </p>
        </div>

        <div className="pill-badge neutral" style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}>
          {pendingCount} pending payment
        </div>
      </div>

      {/* 2-Column Compact Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '1.25rem', alignItems: 'start' }}>
        {/* Left Column: Checkout Card */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.45rem', margin: 0 }}>
              <CreditCard size={16} />
              Checkout
            </h2>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Encrypted Checkout
            </div>
          </div>

          {error && (
            <div style={{
              padding: '0.5rem 0.75rem',
              backgroundColor: 'var(--status-error-bg)',
              border: '1px solid var(--status-error-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--status-error-text)',
              fontSize: '0.8125rem',
              marginBottom: '0.85rem',
            }}>
              {error}
            </div>
          )}

          {/* Select Appointment */}
          <div style={{ marginBottom: '0.85rem' }}>
            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.3rem', display: 'block' }}>
              Select Appointment
            </label>
            <select
              value={selectedBookingId}
              onChange={(e) => {
                setSelectedBookingId(e.target.value);
                setError(null);
                setLastPaymentResult(null);
              }}
              className="form-select"
              style={{ fontSize: '0.8125rem', padding: '0.45rem 0.65rem', height: '36px' }}
            >
              {bookings.length === 0 ? (
                <option value="">No appointments scheduled</option>
              ) : (
                bookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.status === 'PENDING' ? '⏳ [Pending Payment]' : b.status === 'CONFIRMED' ? '✓ [Paid & Confirmed]' : `[${b.status}]`} {b.test_name} — ₹{parseFloat(b.amount).toFixed(2)} ({b.centre_name})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Selected Booking Summary */}
          {selectedBooking && (
            <div style={{
              padding: '0.85rem 1rem',
              backgroundColor: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-light)',
              marginBottom: '0.85rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0, paddingRight: '0.5rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedBooking.test_name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                    {selectedBooking.centre_name}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Payable</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.1 }}>
                    ₹{parseFloat(selectedBooking.amount).toFixed(2)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(0,0,0,0.05)', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Booking Status:</span>
                <span className={`pill-badge ${selectedBooking.status === 'CONFIRMED' ? 'success' : selectedBooking.status === 'PENDING' ? 'warning' : 'error'}`} style={{ padding: '0.1rem 0.5rem' }}>
                  {selectedBooking.status === 'CONFIRMED' ? 'Paid & Confirmed' : selectedBooking.status === 'PENDING' ? 'Pending Payment' : selectedBooking.status}
                </span>
              </div>
            </div>
          )}

          {/* Simulation Toggle (Compact inline buttons) */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 500 }}>
              Payment Simulation Mode
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
              <button
                type="button"
                onClick={() => setSimulationMode('FORCE_SUCCESS')}
                style={{
                  padding: '0.4rem',
                  fontSize: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: simulationMode === 'FORCE_SUCCESS' ? '1px solid var(--text-main)' : '1px solid var(--border-light)',
                  backgroundColor: simulationMode === 'FORCE_SUCCESS' ? 'var(--text-main)' : '#FFFFFF',
                  color: simulationMode === 'FORCE_SUCCESS' ? '#FFFFFF' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: simulationMode === 'FORCE_SUCCESS' ? 600 : 400,
                  transition: 'all 0.12s ease',
                }}
              >
                Instant Success
              </button>

              <button
                type="button"
                onClick={() => setSimulationMode('FORCE_FAILED')}
                style={{
                  padding: '0.4rem',
                  fontSize: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: simulationMode === 'FORCE_FAILED' ? '1px solid var(--status-error-border)' : '1px solid var(--border-light)',
                  backgroundColor: simulationMode === 'FORCE_FAILED' ? 'var(--status-error-bg)' : '#FFFFFF',
                  color: simulationMode === 'FORCE_FAILED' ? 'var(--status-error-text)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: simulationMode === 'FORCE_FAILED' ? 600 : 400,
                  transition: 'all 0.12s ease',
                }}
              >
                Simulate Decline
              </button>
            </div>
          </div>

          {/* Pay Button */}
          <button
            type="button"
            onClick={() => handleProcessPayment()}
            disabled={loading || !selectedBookingId || selectedBooking?.status === 'CONFIRMED'}
            className="btn btn-ink"
            style={{ width: '100%', height: '38px', fontSize: '0.875rem' }}
          >
            {loading ? (
              <>
                <RefreshCw size={13} className="pulse" />
                Processing...
              </>
            ) : selectedBooking?.status === 'CONFIRMED' ? (
              'Appointment Already Paid'
            ) : (
              <>
                Pay ₹{selectedBooking ? parseFloat(selectedBooking.amount).toFixed(2) : '0.00'}
                <span className="arrow-gold">→</span>
              </>
            )}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', marginTop: '0.65rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <Lock size={11} />
            <span>256-bit encrypted simulated processing</span>
          </div>
        </div>

        {/* Right Column: Payment Receipt / Confirmation Card */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.45rem', margin: 0 }}>
              <FileText size={16} />
              Payment Receipt
            </h2>
            {lastPaymentResult && (
              <span className={`pill-badge ${lastPaymentResult.status === 'SUCCESS' ? 'success' : 'error'}`} style={{ fontSize: '0.68rem', padding: '0.1rem 0.5rem' }}>
                {lastPaymentResult.status === 'SUCCESS' ? 'PAID' : 'DECLINED'}
              </span>
            )}
          </div>

          {!lastPaymentResult && (!selectedBooking || selectedBooking.status !== 'CONFIRMED') ? (
            <div style={{
              padding: '2.5rem 1.5rem',
              textAlign: 'center',
              backgroundColor: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-light)',
            }}>
              <CreditCard size={28} style={{ opacity: 0.35, margin: '0 auto 0.5rem' }} />
              <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-main)' }}>
                No Payment Generated
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', lineHeight: 1.5, maxWidth: '280px', margin: '0.25rem auto 0' }}>
                Select a pending appointment on the left and complete payment to generate your official receipt.
              </p>
            </div>
          ) : (
            <div style={{
              padding: '1.1rem',
              backgroundColor: (lastPaymentResult?.status === 'SUCCESS' || selectedBooking?.status === 'CONFIRMED') ? 'var(--status-success-bg)' : 'var(--status-error-bg)',
              border: `1px solid ${(lastPaymentResult?.status === 'SUCCESS' || selectedBooking?.status === 'CONFIRMED') ? 'var(--status-success-border)' : 'var(--status-error-border)'}`,
              borderRadius: 'var(--radius-md)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.85rem' }}>
                {(lastPaymentResult?.status === 'SUCCESS' || selectedBooking?.status === 'CONFIRMED') ? (
                  <CheckCircle2 size={18} color="var(--status-success-dot)" />
                ) : (
                  <XCircle size={18} color="var(--status-error-dot)" />
                )}
                <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: (lastPaymentResult?.status === 'SUCCESS' || selectedBooking?.status === 'CONFIRMED') ? 'var(--status-success-text)' : 'var(--status-error-text)' }}>
                  {(lastPaymentResult?.status === 'SUCCESS' || selectedBooking?.status === 'CONFIRMED') ? 'Payment Verified & Confirmed' : 'Payment Failed'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', fontSize: '0.8125rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>Reference</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.75rem' }}>
                    {lastPaymentResult?.transaction_id || `TXN_${selectedBooking?.id?.substring(0, 8).toUpperCase()}`}
                  </span>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>Amount</span>
                  <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>
                    ₹{parseFloat(lastPaymentResult?.amount || selectedBooking?.amount || 0).toFixed(2)}
                  </span>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>Diagnostic Lab</span>
                  <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>
                    {selectedBooking?.centre_name || 'EVE Partner Lab'}
                  </span>
                </div>
              </div>

              <div style={{
                marginTop: '0.85rem',
                paddingTop: '0.65rem',
                borderTop: '1px solid rgba(0,0,0,0.06)',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
              }}>
                {(lastPaymentResult?.status === 'SUCCESS' || selectedBooking?.status === 'CONFIRMED')
                  ? 'Your appointment has been booked. Digital receipt sent to patient email.'
                  : 'The card was declined. Please verify your details and retry.'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
