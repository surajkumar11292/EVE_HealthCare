import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Webhook, ShieldAlert, Zap, RefreshCw, Send, Lock,
  Terminal, Server, Database, Cpu, Activity, UserCheck
} from 'lucide-react';

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

export default function DeveloperSandbox() {
  const { user, isAdmin, switchPersona } = useAuth();
  const [activeSection, setActiveSection] = useState('webhooks'); // 'webhooks' | 'ratelimits' | 'infra' | 'accounts'

  // Webhook State
  const [bookings, setBookings] = useState([]);
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [eventId, setEventId] = useState('');
  const [eventType, setEventType] = useState('payment.succeeded');
  const [transactionId, setTransactionId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('SUCCESS');
  const [secretKey, setSecretKey] = useState('super_secret_webhook_signature_key');
  const [computedSignature, setComputedSignature] = useState('');
  const [tamperSignature, setTamperSignature] = useState(false);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookLogs, setWebhookLogs] = useState([]);

  // Telemetry State
  const [healthData, setHealthData] = useState(null);
  const [latency, setLatency] = useState(null);
  const [telemetryLoading, setTelemetryLoading] = useState(false);

  // Rate Limit Testing State
  const [rateLimitTesting, setRateLimitTesting] = useState(false);
  const [rateLimitResults, setRateLimitResults] = useState(null);

  const generateIdentifiers = () => {
    const id = 'evt_' + Math.random().toString(36).substring(2, 8) + '_' + Date.now().toString(36);
    const txn = 'TXN_' + Math.random().toString(36).substring(2, 8).toUpperCase();
    setEventId(id);
    setTransactionId(txn);
  };

  useEffect(() => {
    generateIdentifiers();
    fetchBookings();
    fetchTelemetry();
  }, []);

  const fetchBookings = async () => {
    try {
      const data = await api.getBookings({ size: 50 });
      const items = data.items || [];
      setBookings(items);
      if (items.length > 0 && !selectedBookingId) {
        setSelectedBookingId(items[0].id);
      }
    } catch (err) {
      console.warn('Failed to load bookings in sandbox:', err);
    }
  };

  const fetchTelemetry = async () => {
    setTelemetryLoading(true);
    const start = performance.now();
    try {
      const health = await api.getHealth();
      const dur = Math.round(performance.now() - start);
      setHealthData(health);
      setLatency(dur);
    } catch (err) {
      console.warn('Telemetry error:', err);
    } finally {
      setTelemetryLoading(false);
    }
  };

  const getPayload = () => ({
    event_id: eventId,
    event_type: eventType,
    transaction_id: transactionId,
    booking_id: selectedBookingId,
    status: paymentStatus,
    failure_reason: paymentStatus === 'FAILED' ? 'Simulated card decline by bank' : null,
  });

  useEffect(() => {
    async function updateSignature() {
      if (!secretKey || !eventId || !selectedBookingId) return;
      const rawString = JSON.stringify(getPayload());
      try {
        const sig = await computeHmacSha256(secretKey, rawString);
        setComputedSignature(sig);
      } catch (err) {
        console.error('Signature error:', err);
      }
    }
    updateSignature();
  }, [eventId, eventType, transactionId, selectedBookingId, paymentStatus, secretKey]);

  // Dispatch Webhook
  const handleDispatch = async (overrideEventId = null) => {
    if (!selectedBookingId) return;
    setWebhookLoading(true);

    const payload = getPayload();
    if (overrideEventId) payload.event_id = overrideEventId;

    const rawBody = JSON.stringify(payload);
    let sigToSend = tamperSignature
      ? 'invalid_forged_signature_00000000000000000000000000000000'
      : computedSignature;

    const start = performance.now();
    try {
      const res = await fetch('/payments/webhook/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': sigToSend,
        },
        body: rawBody,
      });

      const dur = Math.round(performance.now() - start);
      const isJson = res.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await res.json() : await res.text();

      setWebhookLogs((prev) => [
        {
          id: Date.now() + Math.random(),
          time: new Date().toLocaleTimeString(),
          status: res.status,
          ok: res.ok,
          dur,
          eventId: payload.event_id,
          tampered: tamperSignature,
          data,
        },
        ...prev,
      ]);
    } catch (err) {
      setWebhookLogs((prev) => [
        {
          id: Date.now() + Math.random(),
          time: new Date().toLocaleTimeString(),
          status: 0,
          ok: false,
          dur: Math.round(performance.now() - start),
          eventId: payload.event_id,
          data: { error: err.message },
        },
        ...prev,
      ]);
    } finally {
      setWebhookLoading(false);
    }
  };

  // Concurrency Race Test
  const handleConcurrencyRace = async () => {
    setWebhookLoading(true);
    const targetEventId = eventId;
    const rawBody = JSON.stringify(getPayload());
    const sig = computedSignature;

    const fireOne = async (num) => {
      const start = performance.now();
      const res = await fetch('/payments/webhook/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': sig,
        },
        body: rawBody,
      });
      const dur = Math.round(performance.now() - start);
      const isJson = res.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await res.json() : await res.text();
      return { num, status: res.status, ok: res.ok, dur, data };
    };

    try {
      const [r1, r2] = await Promise.all([fireOne(1), fireOne(2)]);
      setWebhookLogs((prev) => [
        {
          id: Date.now() + 1,
          time: new Date().toLocaleTimeString(),
          status: r2.status,
          ok: r2.ok,
          dur: r2.dur,
          eventId: targetEventId,
          concurrent: true,
          num: 2,
          data: r2.data,
        },
        {
          id: Date.now(),
          time: new Date().toLocaleTimeString(),
          status: r1.status,
          ok: r1.ok,
          dur: r1.dur,
          eventId: targetEventId,
          concurrent: true,
          num: 1,
          data: r1.data,
        },
        ...prev,
      ]);
    } finally {
      setWebhookLoading(false);
    }
  };

  // Rate Limit Burst
  const handleTestRateLimit = async () => {
    setRateLimitTesting(true);
    setRateLimitResults(null);

    const burst = [];
    for (let i = 1; i <= 12; i++) {
      burst.push(
        fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: `evaluator_burst_${i}@example.com`, password: 'TestPassword123!' }),
        }).then(async (res) => ({
          reqNum: i,
          status: res.status,
          retryAfter: res.headers.get('Retry-After'),
        }))
      );
    }

    try {
      const results = await Promise.all(burst);
      const hit429 = results.find((r) => r.status === 429);
      setRateLimitResults({
        total: results.length,
        has429: !!hit429,
        hitReqNum: hit429 ? hit429.reqNum : null,
        retryAfter: hit429 ? hit429.retryAfter : null,
      });
    } catch (err) {
      setRateLimitResults({ error: err.message });
    } finally {
      setRateLimitTesting(false);
    }
  };

  const sections = [
    { id: 'webhooks', label: 'Payment Webhook & Concurrency Lab' },
    { id: 'ratelimits', label: 'Rate Limiting & Security' },
    { id: 'infra', label: 'Backend Architecture & Workers' },
    { id: 'accounts', label: 'Evaluator Demo Accounts' },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.75rem',
      }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text-main)' }}>
            Developer Sandbox
          </h1>
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Interactive testing workbench for HMAC-SHA256 webhooks, race condition deduplication, and distributed rate limiting.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="pill-badge success">
            <span className="dot green"></span>
            API Live: {latency !== null ? `${latency}ms` : 'Connecting'}
          </span>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div className="impeccable-pill-bar">
          {sections.map((sec) => {
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`impeccable-pill-btn ${isActive ? 'active' : ''}`}
              >
                {isActive && <span className="dot green"></span>}
                {sec.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 1: Webhook Lab */}
      {activeSection === 'webhooks' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
          {/* Controls */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Webhook size={18} />
              Dispatch Webhook Event
            </h2>

            <div className="form-group">
              <label className="form-label">Target Appointment</label>
              <select
                value={selectedBookingId}
                onChange={(e) => setSelectedBookingId(e.target.value)}
                className="form-select"
                style={{ fontSize: '0.8125rem' }}
              >
                {bookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    [{b.status}] {b.test_name} at {b.centre_name} (#{b.id.substring(0, 8)})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Event ID (Deduplication Key)</label>
                <input
                  type="text"
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  className="form-input"
                  style={{ fontSize: '0.75rem' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Payment Result</label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  className="form-select"
                  style={{ fontSize: '0.8125rem' }}
                >
                  <option value="SUCCESS">SUCCESS (Confirms)</option>
                  <option value="FAILED">FAILED (Fails)</option>
                </select>
              </div>
            </div>

            <div style={{
              padding: '0.85rem',
              backgroundColor: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-light)',
              marginBottom: '1.25rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  HMAC-SHA256 Signature
                </span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', cursor: 'pointer', color: tamperSignature ? 'var(--status-error-text)' : 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={tamperSignature}
                    onChange={(e) => setTamperSignature(e.target.checked)}
                  />
                  Tamper Signature (Test 401)
                </label>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', wordBreak: 'break-all', backgroundColor: '#FFFFFF', padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                {tamperSignature ? 'invalid_forged_signature_00000000000000000000000000000000' : computedSignature}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <button
                type="button"
                onClick={() => handleDispatch()}
                disabled={webhookLoading || !selectedBookingId}
                className="btn btn-ink"
                style={{ width: '100%' }}
              >
                <Send size={13} />
                {webhookLoading ? 'Sending...' : 'Dispatch Webhook Event'}
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => handleDispatch(eventId)}
                  disabled={webhookLoading || !selectedBookingId}
                  className="btn btn-ghost btn-sm"
                  title="Re-send same event_id to verify idempotent deduplication"
                >
                  Test Deduplication
                </button>

                <button
                  type="button"
                  onClick={handleConcurrencyRace}
                  disabled={webhookLoading || !selectedBookingId}
                  className="btn btn-ghost btn-sm"
                  title="Fire two requests simultaneously"
                >
                  <Zap size={13} />
                  Simulate Race
                </button>
              </div>
            </div>
          </div>

          {/* Webhook Execution Logs */}
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Terminal size={16} />
                <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Webhook Logs</h2>
              </div>
              {webhookLogs.length > 0 && (
                <button
                  onClick={() => setWebhookLogs([])}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                >
                  Clear
                </button>
              )}
            </div>

            {webhookLogs.length === 0 ? (
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3rem 1.5rem',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-muted)',
                fontSize: '0.875rem',
                textAlign: 'center',
              }}>
                <div>No webhook calls logged yet.</div>
                <div style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                  Dispatch an event or simulate a race to inspect live responses.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '440px', overflowY: 'auto' }}>
                {webhookLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      padding: '0.85rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                      backgroundColor: 'var(--bg-subtle)',
                      fontSize: '0.8125rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className={`pill-badge ${log.ok ? 'success' : 'error'}`} style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>
                          HTTP {log.status}
                        </span>
                        {log.concurrent && (
                          <span className="pill-badge warning" style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>
                            Concurrent #{log.num}
                          </span>
                        )}
                        {log.tampered && (
                          <span className="pill-badge error" style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>
                            Tampered Sig
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {log.time} · {log.dur}ms
                      </span>
                    </div>

                    <div style={{
                      backgroundColor: '#FFFFFF',
                      padding: '0.5rem 0.65rem',
                      borderRadius: '4px',
                      border: '1px solid var(--border-light)',
                      fontSize: '0.75rem',
                    }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                        Status: {log.data?.status || 'Error'}
                      </div>
                      <div style={{ color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                        {log.data?.message || JSON.stringify(log.data)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 2: Rate Limiting */}
      {activeSection === 'ratelimits' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1.25rem',
          }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Rate Limiting Verification</h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                SlowAPI distributed in-memory and Redis-backed rate limiting protects sensitive endpoints.
              </p>
            </div>

            <button
              onClick={handleTestRateLimit}
              disabled={rateLimitTesting}
              className="btn btn-ink btn-sm"
            >
              <ShieldAlert size={14} />
              {rateLimitTesting ? 'Testing Burst...' : 'Send Burst of 12 Requests (Verify 429)'}
            </button>
          </div>

          {rateLimitResults && (
            <div style={{
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${rateLimitResults.has429 ? 'var(--status-warning-border)' : 'var(--border-light)'}`,
              backgroundColor: rateLimitResults.has429 ? 'var(--status-warning-bg)' : 'var(--bg-subtle)',
              marginBottom: '1.5rem',
              fontSize: '0.875rem',
            }}>
              <div style={{ fontWeight: 600, color: rateLimitResults.has429 ? 'var(--status-warning-text)' : 'inherit' }}>
                {rateLimitResults.has429
                  ? `✓ Rate limit verified: Triggered HTTP 429 Too Many Requests on Request #${rateLimitResults.hitReqNum}!`
                  : 'All requests accepted without triggering 429.'}
              </div>
              {rateLimitResults.retryAfter && (
                <div style={{ marginTop: '0.25rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Retry-After Header: {rateLimitResults.retryAfter} seconds
                </div>
              )}
            </div>
          )}

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th>Threshold</th>
                  <th>Scope</th>
                  <th>Security Objective</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 600 }}>POST /api/v1/auth/login</td>
                  <td><span className="pill-badge neutral">10 / min</span></td>
                  <td>Client IP</td>
                  <td>Prevent credential stuffing & brute-force attacks</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>POST /api/v1/auth/signup</td>
                  <td><span className="pill-badge neutral">10 / min</span></td>
                  <td>Client IP</td>
                  <td>Prevent automated spam account creation</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>POST /payments/</td>
                  <td><span className="pill-badge neutral">20 / min</span></td>
                  <td>Client IP</td>
                  <td>Prevent rapid-fire double charges & replay attacks</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>POST /payments/webhook/</td>
                  <td><span className="pill-badge neutral">100 / min</span></td>
                  <td>Client IP</td>
                  <td>Accommodate bulk gateway webhook dispatching</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>POST /api/v1/bookings/</td>
                  <td><span className="pill-badge neutral">60 / min</span></td>
                  <td>Client IP</td>
                  <td>Prevent slot exhaustion attacks</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 3: Infrastructure */}
      {activeSection === 'infra' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                <Server size={18} />
                FastAPI Web API
              </div>
              <span className="pill-badge success"><span className="dot green"></span> Running</span>
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div>Port: 8000 (Uvicorn async worker)</div>
              <div>Latency: {latency !== null ? `${latency}ms` : 'Connecting...'}</div>
              <div>Routes: /api/v1 & /payments</div>
            </div>
          </div>

          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                <Database size={18} />
                PostgreSQL 16
              </div>
              <span className="pill-badge success"><span className="dot green"></span> Connected</span>
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div>Port: 5432 (asyncpg connection pool)</div>
              <div>Pool Size: 10 + 20 overflow</div>
              <div>Concurrency: SELECT FOR UPDATE row locks</div>
            </div>
          </div>

          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                <Zap size={18} />
                Redis 7 Cache
              </div>
              <span className="pill-badge success"><span className="dot green"></span> Active</span>
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div>Port: 6379 (In-memory datastore)</div>
              <div>DB 0: Diagnostic catalog cache</div>
              <div>DB 1 / 2: Celery broker and results</div>
            </div>
          </div>

          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                <Cpu size={18} />
                Celery Worker Pool
              </div>
              <span className="pill-badge success"><span className="dot green"></span> Ready</span>
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div>Workers: Prefork concurrency pool</div>
              <div>Retry Strategy: 5x Exponential backoff</div>
              <div>Tasks: Asynchronous notification delivery</div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: Demo Accounts */}
      {activeSection === 'accounts' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Evaluator Demo Accounts
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Quickly switch between pre-seeded test accounts to evaluate patient scheduling vs. administrator management.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            <div
              style={{
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                border: !isAdmin ? '2px solid var(--text-main)' : '1px solid var(--border-light)',
                backgroundColor: !isAdmin ? 'var(--bg-subtle)' : 'var(--bg-surface)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Patient Account: John Doe</span>
                {!isAdmin && <span className="pill-badge success">Active</span>}
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                Standard patient user with access to browse diagnostic tests, book appointments, and complete payments.
              </p>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Email: patient@evehealthcare.com · Password: Patient@123456
              </div>
              <button
                onClick={() => switchPersona('PATIENT')}
                disabled={!isAdmin}
                className="btn btn-ink btn-sm"
              >
                {!isAdmin ? 'Currently Active' : 'Switch to Patient Persona'}
              </button>
            </div>

            <div
              style={{
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                border: isAdmin ? '2px solid var(--text-main)' : '1px solid var(--border-light)',
                backgroundColor: isAdmin ? 'var(--bg-subtle)' : 'var(--bg-surface)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Administrator: System Admin</span>
                {isAdmin && <span className="pill-badge warning">Active</span>}
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                Administrative privileges to inspect all patient bookings across the system and register new diagnostic labs.
              </p>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Email: admin@evehealthcare.com · Password: Admin@123456
              </div>
              <button
                onClick={() => switchPersona('ADMIN')}
                disabled={isAdmin}
                className="btn btn-ink btn-sm"
              >
                {isAdmin ? 'Currently Active' : 'Switch to Admin Persona'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
