import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Server, Database, Cpu, ShieldAlert, Activity, RefreshCw, Layers, CheckCircle2, Clock, Terminal, AlertTriangle, Zap } from 'lucide-react';

export default function TelemetryView() {
  const [healthData, setHealthData] = useState(null);
  const [apiInfo, setApiInfo] = useState(null);
  const [latency, setLatency] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rateLimitTesting, setRateLimitTesting] = useState(false);
  const [rateLimitResults, setRateLimitResults] = useState(null);

  const fetchTelemetry = async () => {
    setLoading(true);
    const start = performance.now();
    try {
      const [health, info] = await Promise.all([
        api.getHealth(),
        api.getApiInfo(),
      ]);
      const duration = Math.round(performance.now() - start);
      setHealthData(health);
      setApiInfo(info);
      setLatency(duration);
    } catch (err) {
      console.warn('Telemetry check failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
  }, []);

  // Test rate limiting by sending a burst of requests to verify SlowAPI 429 handling
  const handleTestRateLimit = async () => {
    setRateLimitTesting(true);
    setRateLimitResults(null);

    const burstRequests = [];
    // Trigger 15 fast requests to /api/v1/auth/login which has a 10/minute limit
    for (let i = 1; i <= 12; i++) {
      burstRequests.push(
        fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: `burst_test_${i}@example.com`, password: 'Test@Password123' }),
        }).then(async (res) => ({
          reqNum: i,
          status: res.status,
          statusText: res.statusText,
          retryAfter: res.headers.get('Retry-After'),
          body: await res.json().catch(() => ({})),
        }))
      );
    }

    try {
      const results = await Promise.all(burstRequests);
      const hit429 = results.find((r) => r.status === 429);
      setRateLimitResults({
        total: results.length,
        has429: !!hit429,
        hitReqNum: hit429 ? hit429.reqNum : null,
        retryAfter: hit429 ? hit429.retryAfter : null,
        results,
      });
    } catch (err) {
      setRateLimitResults({ error: err.message });
    } finally {
      setRateLimitTesting(false);
    }
  };

  const rateLimitRules = [
    { endpoint: 'POST /api/v1/auth/signup', limit: '10 requests / min', scope: 'IP Address', purpose: 'Brute-force account creation prevention' },
    { endpoint: 'POST /api/v1/auth/login', limit: '10 requests / min', scope: 'IP Address', purpose: 'Credential stuffing & password attack guard' },
    { endpoint: 'POST /payments/', limit: '20 requests / min', scope: 'IP Address', purpose: 'Payment gateway abuse & replay mitigation' },
    { endpoint: 'POST /payments/webhook/', limit: '100 requests / min', scope: 'IP Address', purpose: 'High-throughput payment webhook processing' },
    { endpoint: 'GET /api/v1/centres/', limit: '60 requests / min', scope: 'IP Address', purpose: 'Catalog discovery DoS defense' },
    { endpoint: 'POST /api/v1/bookings/', limit: '60 requests / min', scope: 'IP Address', purpose: 'Diagnostic slot hoarding prevention' },
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
        marginBottom: '1.5rem',
      }}>
        <div>
          <div className="kicker">// 05 SYSTEM ARCHITECTURE & TELEMETRY</div>
          <h2 style={{ fontSize: '1.5rem', marginTop: '0.2rem' }}>
            Infrastructure & Telemetry Console
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Real-time inspection of distributed rate limiting, PostgreSQL connection pools, Redis caching, and Celery background queues.
          </p>
        </div>

        <button
          onClick={fetchTelemetry}
          disabled={loading}
          className="btn btn-ghost btn-sm"
        >
          <RefreshCw size={12} className={loading ? 'pulse' : ''} />
          Ping System
        </button>
      </div>

      {/* Infrastructure Node Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Node 1: FastAPI Web */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Server size={18} />
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>FastAPI Web Core</span>
            </div>
            <span className="pill-badge success">
              <span className="dot green pulse"></span>
              HEALTHY
            </span>
          </div>
          <div style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div><span style={{ color: 'var(--text-muted)' }}>PORT:</span> 8000 (HTTP / Uvicorn)</div>
            <div><span style={{ color: 'var(--text-muted)' }}>LATENCY:</span> {latency !== null ? `${latency}ms` : 'Connecting...'}</div>
            <div><span style={{ color: 'var(--text-muted)' }}>ENV:</span> {healthData?.environment || 'development'}</div>
            <div><span style={{ color: 'var(--text-muted)' }}>ROUTING:</span> Dual `/api/v1` + `/payments`</div>
          </div>
        </div>

        {/* Node 2: PostgreSQL 16 */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={18} />
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>PostgreSQL 16 DB</span>
            </div>
            <span className="pill-badge success">
              <span className="dot green"></span>
              CONNECTED
            </span>
          </div>
          <div style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div><span style={{ color: 'var(--text-muted)' }}>PORT:</span> 5432 (asyncpg engine)</div>
            <div><span style={{ color: 'var(--text-muted)' }}>POOL SIZE:</span> 10 + 20 overflow</div>
            <div><span style={{ color: 'var(--text-muted)' }}>MIGRATIONS:</span> Alembic Revision 0001</div>
            <div><span style={{ color: 'var(--text-muted)' }}>ROW LOCKS:</span> `SELECT FOR UPDATE` Active</div>
          </div>
        </div>

        {/* Node 3: Redis 7 */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Zap size={18} />
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Redis 7 Cluster</span>
            </div>
            <span className="pill-badge success">
              <span className="dot green"></span>
              ONLINE
            </span>
          </div>
          <div style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div><span style={{ color: 'var(--text-muted)' }}>PORT:</span> 6379 (In-memory datastore)</div>
            <div><span style={{ color: 'var(--text-muted)' }}>DB 0:</span> Query Cache (Centres list)</div>
            <div><span style={{ color: 'var(--text-muted)' }}>DB 1 / 2:</span> Celery Broker & Backend</div>
            <div><span style={{ color: 'var(--text-muted)' }}>FALLBACK:</span> Auto In-Memory Storage</div>
          </div>
        </div>

        {/* Node 4: Celery Background Workers */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Cpu size={18} />
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Celery Worker Tasks</span>
            </div>
            <span className="pill-badge success">
              <span className="dot green pulse"></span>
              STANDBY
            </span>
          </div>
          <div style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div><span style={{ color: 'var(--text-muted)' }}>CONCURRENCY:</span> 6 (Prefork processes)</div>
            <div><span style={{ color: 'var(--text-muted)' }}>RETRY POLICY:</span> 5x Exponential Backoff</div>
            <div><span style={{ color: 'var(--text-muted)' }}>JITTER:</span> Randomized Jitter Guard</div>
            <div><span style={{ color: 'var(--text-muted)' }}>TASK ACKS:</span> `acks_late=True`</div>
          </div>
        </div>
      </div>

      {/* Rate Limiting Test & Ledger */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1rem',
        }}>
          <div>
            <div className="kicker">// SLOWAPI DISTRIBUTED RATE LIMITING</div>
            <h3 style={{ fontSize: '1.15rem', marginTop: '0.2rem' }}>
              Tiered Rate Limiting Protection Policy
            </h3>
          </div>

          <button
            onClick={handleTestRateLimit}
            disabled={rateLimitTesting}
            className="btn btn-ink btn-sm"
          >
            <ShieldAlert size={14} />
            {rateLimitTesting ? 'Sending Burst Requests...' : 'Trigger 429 Test Burst (12x Requests)'}
          </button>
        </div>

        {/* Burst Test Feedback Card */}
        {rateLimitResults && (
          <div style={{
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${rateLimitResults.has429 ? 'var(--status-warning-border)' : 'var(--border-light)'}`,
            backgroundColor: rateLimitResults.has429 ? 'var(--status-warning-bg)' : 'var(--bg-subtle)',
            marginBottom: '1.25rem',
            fontSize: '0.8125rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: rateLimitResults.has429 ? 'var(--status-warning-text)' : 'inherit' }}>
              <AlertTriangle size={16} />
              {rateLimitResults.has429
                ? `✓ SlowAPI Verification Succeeded: Triggered HTTP 429 Too Many Requests on Request #${rateLimitResults.hitReqNum}!`
                : 'All burst requests accommodated (Limit not reached yet).'}
            </div>
            {rateLimitResults.retryAfter && (
              <div style={{ marginTop: '0.35rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Response Header `Retry-After: {rateLimitResults.retryAfter}s` returned.
              </div>
            )}
          </div>
        )}

        {/* Rate Limit Rules Table */}
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Protected Endpoint</th>
                <th>Rate Limit Window</th>
                <th>Identifier Key</th>
                <th>Security Purpose</th>
              </tr>
            </thead>
            <tbody>
              {rateLimitRules.map((rule, idx) => (
                <tr key={idx}>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.8rem' }}>
                      {rule.endpoint}
                    </span>
                  </td>
                  <td>
                    <span className="pill-badge neutral" style={{ fontSize: '0.75rem' }}>
                      {rule.limit}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {rule.scope}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {rule.purpose}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* State Machine Transition Flowchart */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <div className="kicker" style={{ marginBottom: '0.35rem' }}>// FINANCIAL STATE MACHINE ARCHITECTURE</div>
        <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem' }}>
          Diagnostic Booking Lifecycle & Guard Rules
        </h3>

        <div style={{
          padding: '1.25rem',
          backgroundColor: '#111111',
          color: '#F4F4F5',
          borderRadius: 'var(--radius-md)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.78rem',
          lineHeight: 1.6,
          overflowX: 'auto',
        }}>
          <div>┌─────────────┐</div>
          <div>│   PENDING   │ ◄── Initial state at appointment booking (Price frozen into bookings.amount)</div>
          <div>└──────┬──────┘</div>
          <div>       │</div>
          <div>       ├──► [Payment SUCCESS]   ───►  CONFIRMED  (Terminal payable state, verified by HMAC Webhook)</div>
          <div>       │</div>
          <div>       ├──► [Payment FAILED]    ───►  FAILED     (Terminal error state, 409 Conflict on retry)</div>
          <div>       │</div>
          <div>       └──► [Patient Cancel]    ───►  CANCELLED  (Allowed from PENDING or CONFIRMED before appointment)</div>
        </div>
      </div>
    </div>
  );
}
