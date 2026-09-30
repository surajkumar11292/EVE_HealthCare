import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { CreditCard, CheckCircle2, XCircle, RefreshCw, Key, ShieldCheck, AlertCircle, ArrowRight, Lock, Copy, Check } from 'lucide-react';

export default function PaymentsView({ initialBooking, onPaymentSuccess }) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [selectedBookingId, setSelectedBookingId] = useState(initialBooking?.id || '');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [simulationMode, setSimulationMode] = useState('REALISTIC'); // 'REALISTIC' | 'FORCE_SUCCESS' | 'FORCE_FAILED'
  const [loading, setLoading] = useState(false);
  const [lastPaymentResult, setLastPaymentResult] = useState(null);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Generate clean client-side idempotency key
  const generateIdempotencyKey = () => {
    const key = 'idemp-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
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
      // Auto-select initial or first pending booking
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
      console.warn('Failed to load bookings for payment selector:', err);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [initialBooking]);

  const selectedBooking = bookings.find((b) => b.id === selectedBookingId);

  const handleProcessPayment = async (overrideKey = null) => {
    if (!selectedBookingId) {
      setError('Please select a booking to initiate simulated payment.');
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

      // Refresh bookings ledger in background
      await fetchBookings();
      if (onPaymentSuccess) {
        onPaymentSuccess(result);
      }
    } catch (err) {
      setError(err.message || 'Payment simulation failed.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
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
          <div className="kicker">// 03 SIMULATED PAYMENT ENGINE & IDEMPOTENCY</div>
          <h2 style={{ fontSize: '1.5rem', marginTop: '0.2rem' }}>
            Payment Gateway Console
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Simulate realistic payment settlements, verify client-driven idempotency keys, and observe automated state machine transitions.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
        {/* Left: Payment Form & Controls */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CreditCard size={18} />
            Simulate Checkout Transaction
          </h3>

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
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* Booking Selector */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Select Diagnostic Booking</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {bookings.filter((b) => b.status === 'PENDING').length} pending payment
              </span>
            </label>
            <select
              value={selectedBookingId}
              onChange={(e) => {
                setSelectedBookingId(e.target.value);
                setError(null);
              }}
              className="form-select"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}
            >
              {bookings.length === 0 ? (
                <option value="">No bookings available</option>
              ) : (
                bookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    [{b.status}] {b.test_name} at {b.centre_name} — ₹{b.amount} ({b.id.substring(0, 8)}...)
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Selected Booking Summary */}
          {selectedBooking && (
            <div style={{
              padding: '1rem',
              backgroundColor: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-light)',
              marginBottom: '1.25rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                    {selectedBooking.test_name}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {selectedBooking.centre_name} · {selectedBooking.centre_location}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    FROZEN AMOUNT
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                    ₹{parseFloat(selectedBooking.amount).toFixed(2)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem', borderTop: '1px dashed var(--border-subtle)', paddingTop: '0.5rem', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>CURRENT STATE:</span>
                <span className={`pill-badge ${selectedBooking.status === 'CONFIRMED' ? 'success' : selectedBooking.status === 'PENDING' ? 'warning' : 'error'}`} style={{ padding: '0.1rem 0.4rem', fontSize: '0.65rem' }}>
                  <span className={`dot ${selectedBooking.status === 'CONFIRMED' ? 'green' : selectedBooking.status === 'PENDING' ? 'amber pulse' : 'rose'}`}></span>
                  {selectedBooking.status}
                </span>
              </div>
            </div>
          )}

          {/* Idempotency Key Manager */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Client Idempotency Key</span>
              <button
                type="button"
                onClick={generateIdempotencyKey}
                className="btn btn-ghost btn-sm"
                style={{ padding: '0.1rem 0.4rem', height: '20px', fontSize: '0.7rem' }}
              >
                <RefreshCw size={10} />
                Regenerate
              </button>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                required
                value={idempotencyKey}
                onChange={(e) => setIdempotencyKey(e.target.value)}
                placeholder="Unique idempotency string"
                className="form-input font-mono"
                style={{ fontSize: '0.8rem', paddingLeft: '2rem' }}
              />
              <Key size={13} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Prevents double charges. Submitting identical keys returns existing payment record.
            </span>
          </div>

          {/* Simulation Outcome Mode */}
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Simulation Mode</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setSimulationMode('REALISTIC')}
                style={{
                  padding: '0.5rem',
                  fontSize: '0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: simulationMode === 'REALISTIC' ? '1px solid var(--border-strong)' : '1px solid var(--border-light)',
                  backgroundColor: simulationMode === 'REALISTIC' ? 'var(--bg-dark)' : 'var(--bg-subtle)',
                  color: simulationMode === 'REALISTIC' ? 'var(--text-inverse)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontWeight: 600 }}>🎲 Realistic</div>
                <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>80% / 20% Mock</div>
              </button>

              <button
                type="button"
                onClick={() => setSimulationMode('FORCE_SUCCESS')}
                style={{
                  padding: '0.5rem',
                  fontSize: '0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: simulationMode === 'FORCE_SUCCESS' ? '1px solid #10B981' : '1px solid var(--border-light)',
                  backgroundColor: simulationMode === 'FORCE_SUCCESS' ? '#ECFDF5' : 'var(--bg-subtle)',
                  color: simulationMode === 'FORCE_SUCCESS' ? '#047857' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontWeight: 600 }}>🟢 Force Success</div>
                <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>100% Confirm</div>
              </button>

              <button
                type="button"
                onClick={() => setSimulationMode('FORCE_FAILED')}
                style={{
                  padding: '0.5rem',
                  fontSize: '0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: simulationMode === 'FORCE_FAILED' ? '1px solid #F43F5E' : '1px solid var(--border-light)',
                  backgroundColor: simulationMode === 'FORCE_FAILED' ? '#FFF1F2' : 'var(--bg-subtle)',
                  color: simulationMode === 'FORCE_FAILED' ? '#BE123C' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontWeight: 600 }}>🔴 Force Fail</div>
                <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>Simulate Decline</div>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={() => handleProcessPayment()}
              disabled={loading || !selectedBookingId}
              className="btn btn-ink"
              style={{ width: '100%', padding: '0.65rem' }}
            >
              {loading ? 'Processing Transaction...' : 'Process Payment ->'}
            </button>

            {lastPaymentResult && (
              <button
                type="button"
                onClick={() => handleProcessPayment(lastPaymentResult.idempotency_key)}
                disabled={loading}
                className="btn btn-ghost"
                style={{ width: '100%', fontSize: '0.8rem', borderStyle: 'dashed' }}
                title="Send the exact same request with identical idempotency_key"
              >
                <ShieldCheck size={14} />
                Test Idempotency (Replay with same key)
              </button>
            )}
          </div>
        </div>

        {/* Right: Live Payment Receipt & Transaction Ledger */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Live Result Receipt Card */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div className="kicker" style={{ marginBottom: '0.35rem' }}>// SETTLEMENT RECEIPT</div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
              Transaction Verification
            </h3>

            {!lastPaymentResult ? (
              <div style={{
                padding: '2.5rem 1rem',
                textAlign: 'center',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-muted)',
                fontSize: '0.8125rem',
              }}>
                Initiate a payment simulation on the left to inspect the cryptographic response and state change.
              </div>
            ) : (
              <div style={{
                padding: '1.25rem',
                backgroundColor: lastPaymentResult.status === 'SUCCESS' ? 'var(--status-success-bg)' : 'var(--status-error-bg)',
                border: `1px solid ${lastPaymentResult.status === 'SUCCESS' ? 'var(--status-success-border)' : 'var(--status-error-border)'}`,
                borderRadius: 'var(--radius-md)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span className={`pill-badge ${lastPaymentResult.status === 'SUCCESS' ? 'success' : 'error'}`}>
                    <span className={`dot ${lastPaymentResult.status === 'SUCCESS' ? 'green' : 'rose'}`}></span>
                    {lastPaymentResult.status}
                  </span>

                  {lastPaymentResult.replayed && (
                    <span className="pill-badge neutral" style={{ fontSize: '0.65rem', backgroundColor: '#FFFFFF' }}>
                      IDEMPOTENT REPLAY MATCH
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', fontSize: '0.8125rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>TRANSACTION ID</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{lastPaymentResult.transaction_id}</span>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>SETTLED AMOUNT</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1rem' }}>
                      ₹{parseFloat(lastPaymentResult.amount).toFixed(2)}
                    </span>
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>IDEMPOTENCY KEY</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                      {lastPaymentResult.idempotency_key}
                    </span>
                  </div>

                  {lastPaymentResult.failure_reason && (
                    <div style={{ gridColumn: 'span 2', color: 'var(--status-error-text)', fontSize: '0.8rem' }}>
                      <strong>Failure Reason:</strong> {lastPaymentResult.failure_reason}
                    </div>
                  )}
                </div>

                <div style={{
                  marginTop: '0.75rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid rgba(0,0,0,0.06)',
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-secondary)',
                }}>
                  {lastPaymentResult.status === 'SUCCESS'
                    ? '✓ State Machine Guard: Booking state automatically updated to CONFIRMED.'
                    : '✕ State Machine Guard: Booking state updated to FAILED.'}
                </div>
              </div>
            )}
          </div>

          {/* Educational Callout on Idempotency */}
          <div className="card" style={{ padding: '1.25rem', backgroundColor: '#FFFFFF' }}>
            <div className="kicker" style={{ marginBottom: '0.25rem' }}>// ARCHITECTURAL GUARANTEE</div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.35rem' }}>
              Double-Spend & Retry Protection
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              In real-world networks, clients or proxies frequently retry dropped requests. The backend pairs unique database indices with client-side <code>idempotency_key</code> values to guarantee at-most-once financial execution.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
