import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Webhook, ShieldAlert, ShieldCheck, Zap, RefreshCw, Send, Lock, AlertCircle, Copy, Check, Terminal } from 'lucide-react';

// Pure native browser HMAC-SHA256 calculation using Web Crypto API
async function computeHmacSha256(secret, message) {
  const enc = new TextEncoder();
  const key = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await window.crypto.subtle.sign('HMAC', key, enc.encode(message));
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function WebhookSandbox({ initialBooking }) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [selectedBookingId, setSelectedBookingId] = useState(initialBooking?.id || '');

  // Webhook fields
  const [eventId, setEventId] = useState('');
  const [eventType, setEventType] = useState('payment.succeeded');
  const [transactionId, setTransactionId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('SUCCESS');
  const [secretKey, setSecretKey] = useState('super_secret_webhook_signature_key');
  const [computedSignature, setComputedSignature] = useState('');
  const [tamperSignature, setTamperSignature] = useState(false);

  // Execution states
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);

  const generateIdentifiers = () => {
    const id = 'evt-sim-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
    const txn = 'TXN-WH-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    setEventId(id);
    setTransactionId(txn);
  };

  useEffect(() => {
    generateIdentifiers();
  }, []);

  const fetchBookings = async () => {
    try {
      const data = await api.getBookings({ size: 50 });
      const items = data.items || [];
      setBookings(items);
      if (initialBooking) {
        setSelectedBookingId(initialBooking.id);
      } else if (items.length > 0 && !selectedBookingId) {
        setSelectedBookingId(items[0].id);
      }
    } catch (err) {
      console.warn('Failed to load bookings for webhook sandbox:', err);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [initialBooking]);

  // Construct raw payload object
  const getPayload = () => ({
    event_id: eventId,
    event_type: eventType,
    transaction_id: transactionId,
    booking_id: selectedBookingId,
    status: paymentStatus,
    failure_reason: paymentStatus === 'FAILED' ? 'Simulated card decline by issuing bank' : null,
  });

  // Calculate signature in real-time whenever payload or secret changes
  useEffect(() => {
    async function updateSignature() {
      if (!secretKey || !eventId || !selectedBookingId) return;
      const rawString = JSON.stringify(getPayload());
      try {
        const sig = await computeHmacSha256(secretKey, rawString);
        setComputedSignature(sig);
      } catch (err) {
        console.error('Signature computation failed:', err);
      }
    }
    updateSignature();
  }, [eventId, eventType, transactionId, selectedBookingId, paymentStatus, secretKey]);

  // Single Webhook Dispatcher
  const handleDispatch = async (overrideEventId = null, overrideSig = null) => {
    if (!selectedBookingId) {
      setError('Please select or specify a valid Booking UUID.');
      return;
    }

    setLoading(true);
    setError(null);

    const payload = getPayload();
    if (overrideEventId) {
      payload.event_id = overrideEventId;
    }

    const rawBody = JSON.stringify(payload);
    let signatureToSend = overrideSig || computedSignature;

    if (tamperSignature) {
      signatureToSend = 'bad_forged_signature_00000000000000000000000000000000';
    }

    const startTime = performance.now();
    try {
      const response = await fetch('/payments/webhook/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signatureToSend,
        },
        body: rawBody,
      });

      const durationMs = Math.round(performance.now() - startTime);
      const isJson = response.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await response.json() : await response.text();

      const logEntry = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toLocaleTimeString(),
        status: response.status,
        ok: response.ok,
        durationMs,
        eventId: payload.event_id,
        tampered: tamperSignature,
        data,
      };

      setLogs((prev) => [logEntry, ...prev]);
    } catch (err) {
      const durationMs = Math.round(performance.now() - startTime);
      setLogs((prev) => [
        {
          id: Date.now() + Math.random(),
          timestamp: new Date().toLocaleTimeString(),
          status: 0,
          ok: false,
          durationMs,
          eventId: payload.event_id,
          data: { error: err.message },
        },
        ...prev,
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Replay Same Webhook (Test Deduplication)
  const handleReplay = async () => {
    await handleDispatch(eventId);
  };

  // Fire Concurrent Race (2x simultaneous identical webhooks)
  const handleConcurrencyRace = async () => {
    setLoading(true);
    setError(null);
    const targetEventId = eventId;
    const payload = getPayload();
    const rawBody = JSON.stringify(payload);
    const sig = computedSignature;

    const fireOne = async (index) => {
      const startTime = performance.now();
      const response = await fetch('/payments/webhook/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': sig,
        },
        body: rawBody,
      });
      const durationMs = Math.round(performance.now() - startTime);
      const isJson = response.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await response.json() : await response.text();
      return { index, status: response.status, ok: response.ok, durationMs, data };
    };

    try {
      // Execute simultaneously
      const [resA, resB] = await Promise.all([fireOne(1), fireOne(2)]);

      setLogs((prev) => [
        {
          id: Date.now() + 1,
          timestamp: new Date().toLocaleTimeString(),
          status: resB.status,
          ok: resB.ok,
          durationMs: resB.durationMs,
          eventId: targetEventId,
          concurrent: true,
          reqNum: 2,
          data: resB.data,
        },
        {
          id: Date.now(),
          timestamp: new Date().toLocaleTimeString(),
          status: resA.status,
          ok: resA.ok,
          durationMs: resA.durationMs,
          eventId: targetEventId,
          concurrent: true,
          reqNum: 1,
          data: resA.data,
        },
        ...prev,
      ]);
    } catch (err) {
      setError(err.message || 'Concurrency test encountered an error.');
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
        marginBottom: '1.5rem',
      }}>
        <div>
          <div className="kicker">// 04 WEBHOOK TESTING & CONCURRENCY LAB</div>
          <h2 style={{ fontSize: '1.5rem', marginTop: '0.2rem' }}>
            Payment Webhook Sandbox
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Verify constant-time HMAC-SHA256 signatures, test idempotent event deduplication, and simulate concurrent race conditions.
          </p>
        </div>

        <button
          onClick={generateIdentifiers}
          className="btn btn-ghost btn-sm"
          title="Generate fresh Event ID and Transaction ID"
        >
          <RefreshCw size={12} />
          New Event Context
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.5rem' }}>
        {/* Left: Webhook Payload Builder */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Webhook size={18} />
            Webhook Event Payload
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
            }}>
              {error}
            </div>
          )}

          {/* Booking Target */}
          <div className="form-group">
            <label className="form-label">Target Diagnostic Booking</label>
            <select
              value={selectedBookingId}
              onChange={(e) => setSelectedBookingId(e.target.value)}
              className="form-select font-mono"
              style={{ fontSize: '0.8125rem' }}
            >
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  [{b.status}] {b.test_name} at {b.centre_name} ({b.id.substring(0, 8)}...)
                </option>
              ))}
            </select>
          </div>

          {/* Event ID & Type */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Event ID (Idempotency Key)</label>
              <input
                type="text"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="form-input font-mono"
                style={{ fontSize: '0.78rem' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Resulting Status</label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                className="form-select font-mono"
                style={{ fontSize: '0.8125rem' }}
              >
                <option value="SUCCESS">SUCCESS (Confirms Booking)</option>
                <option value="FAILED">FAILED (Fails Booking)</option>
              </select>
            </div>
          </div>

          {/* Transaction ID */}
          <div className="form-group">
            <label className="form-label">Transaction Reference</label>
            <input
              type="text"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              className="form-input font-mono"
              style={{ fontSize: '0.78rem' }}
            />
          </div>

          {/* HMAC Secret & Tamper Toggle */}
          <div style={{
            padding: '0.85rem',
            backgroundColor: 'var(--bg-subtle)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)',
            marginBottom: '1.25rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 600 }}>
                <Lock size={12} />
                HMAC-SHA256 SIGNATURE ENGINE
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', cursor: 'pointer', color: tamperSignature ? 'var(--status-error-text)' : 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={tamperSignature}
                  onChange={(e) => setTamperSignature(e.target.checked)}
                />
                Tamper Signature (Test 401)
              </label>
            </div>

            <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', wordBreak: 'break-all', backgroundColor: 'var(--bg-surface)', padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
              {tamperSignature ? 'bad_forged_signature_00000000000000000000000000000000' : computedSignature}
            </div>
          </div>

          {/* Test Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <button
              type="button"
              onClick={() => handleDispatch()}
              disabled={loading || !selectedBookingId}
              className="btn btn-ink"
              style={{ width: '100%' }}
            >
              <Send size={13} />
              {loading ? 'Dispatching Webhook...' : 'Dispatch Webhook Event'}
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={handleReplay}
                disabled={loading || !selectedBookingId}
                className="btn btn-ghost"
                style={{ fontSize: '0.75rem', padding: '0.45rem' }}
                title="Re-send same event_id to verify 'already_processed' response"
              >
                <ShieldCheck size={13} />
                Test Deduplication
              </button>

              <button
                type="button"
                onClick={handleConcurrencyRace}
                disabled={loading || !selectedBookingId}
                className="btn btn-ghost"
                style={{ fontSize: '0.75rem', padding: '0.45rem', borderColor: 'var(--status-warning-border)', color: 'var(--status-warning-text)' }}
                title="Fires 2 simultaneous requests with identical payload"
              >
                <Zap size={13} />
                Fire Concurrent Race
              </button>
            </div>
          </div>
        </div>

        {/* Right: Live Terminal & Verification Ledger */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Terminal size={16} />
              <h3 style={{ fontSize: '1.1rem' }}>Execution Log</h3>
            </div>
            {logs.length > 0 && (
              <button
                onClick={() => setLogs([])}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', height: '20px' }}
              >
                Clear
              </button>
            )}
          </div>

          {logs.length === 0 ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '3rem 1rem',
              backgroundColor: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-muted)',
              fontSize: '0.8125rem',
              textAlign: 'center',
            }}>
              <Webhook size={28} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
              <div>No webhook executions logged yet.</div>
              <div style={{ fontSize: '0.72rem', marginTop: '0.25rem' }}>
                Dispatch an event or simulate a concurrency race to inspect the live response.
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              maxHeight: '480px',
              overflowY: 'auto',
            }}>
              {logs.map((log) => {
                const isAlreadyProcessed = log.data?.status === 'already_processed';
                const isSuccess = log.status === 200 && log.data?.status === 'processed';

                return (
                  <div
                    key={log.id}
                    style={{
                      padding: '0.85rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                      backgroundColor: 'var(--bg-subtle)',
                      fontSize: '0.78rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span className={`pill-badge ${log.ok ? 'success' : 'error'}`} style={{ padding: '0.1rem 0.4rem', fontSize: '0.65rem' }}>
                          HTTP {log.status}
                        </span>
                        {log.concurrent && (
                          <span className="pill-badge warning" style={{ padding: '0.1rem 0.4rem', fontSize: '0.65rem' }}>
                            CONCURRENT #{log.reqNum}
                          </span>
                        )}
                        {log.tampered && (
                          <span className="pill-badge error" style={{ padding: '0.1rem 0.4rem', fontSize: '0.65rem' }}>
                            TAMPERED SIG
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {log.timestamp} · {log.durationMs}ms
                      </div>
                    </div>

                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      backgroundColor: '#FFFFFF',
                      padding: '0.5rem 0.65rem',
                      borderRadius: '4px',
                      border: '1px solid var(--border-light)',
                      overflowX: 'auto',
                    }}>
                      <div style={{ color: isAlreadyProcessed ? 'var(--status-warning-text)' : isSuccess ? 'var(--status-success-text)' : 'inherit', fontWeight: 600 }}>
                        STATUS: {log.data?.status || 'ERROR'}
                      </div>
                      <div style={{ color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        {log.data?.message || JSON.stringify(log.data)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
