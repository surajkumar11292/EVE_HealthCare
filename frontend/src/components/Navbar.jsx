import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Activity, Shield, User, LogOut, ArrowRight, Zap, RefreshCw } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
  const { user, isAuthenticated, isAdmin, switchPersona, logout } = useAuth();
  const [health, setHealth] = useState({ status: 'checking', responseTime: null });

  useEffect(() => {
    let isMounted = true;
    async function checkHealth() {
      const start = performance.now();
      try {
        const data = await api.getHealth();
        const duration = Math.round(performance.now() - start);
        if (isMounted) {
          setHealth({ status: 'online', data, responseTime: duration });
        }
      } catch (err) {
        if (isMounted) {
          setHealth({ status: 'offline', error: err.message, responseTime: null });
        }
      }
    }
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const tabs = [
    { id: 'catalog', label: 'Catalog Matrix', tag: '01' },
    { id: 'bookings', label: 'Bookings Ledger', tag: '02' },
    { id: 'payments', label: 'Simulated Gateway', tag: '03' },
    { id: 'webhooks', label: 'Webhook Sandbox', tag: '04' },
    { id: 'telemetry', label: 'System Architecture', tag: '05' },
  ];

  return (
    <header style={{
      borderBottom: '1px solid var(--border-light)',
      backgroundColor: 'var(--bg-surface)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* Top Meta Bar */}
      <div style={{
        borderBottom: '1px solid #F4F4F5',
        padding: '0.35rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.75rem',
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-muted)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span>// EVE HEALTHCARE BACKEND ENGINE</span>
          <span>·</span>
          <span>FASTAPI + POSTGRESQL + REDIS + CELERY</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          {/* Live API Health indicator */}
          <div className={`pill-badge ${health.status === 'online' ? 'success' : 'error'}`} style={{ padding: '0.15rem 0.5rem', fontSize: '0.7rem' }}>
            <span className={`dot ${health.status === 'online' ? 'green pulse' : 'rose'}`}></span>
            {health.status === 'online' ? `API ONLINE (${health.responseTime}ms)` : 'API CONNECTING'}
          </div>

          {/* Quick Persona Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: 'var(--text-faint)' }}>PERSONA:</span>
            {isAuthenticated ? (
              <span className={`pill-badge ${isAdmin ? 'warning' : 'neutral'}`} style={{ padding: '0.15rem 0.5rem', fontSize: '0.7rem' }}>
                <span className={`dot ${isAdmin ? 'amber' : 'green'}`}></span>
                {isAdmin ? '🛡️ ADMIN: System Admin' : '👤 PATIENT: John Doe'}
              </span>
            ) : (
              <span className="pill-badge neutral" style={{ padding: '0.15rem 0.5rem', fontSize: '0.7rem' }}>
                NOT LOGGED IN
              </span>
            )}

            <button
              onClick={() => switchPersona(isAdmin ? 'PATIENT' : 'ADMIN')}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', height: '22px' }}
              title="Click to toggle between Patient and Admin roles"
            >
              <RefreshCw size={10} />
              Switch to {isAdmin ? 'Patient' : 'Admin'}
            </button>

            {isAuthenticated && (
              <button
                onClick={logout}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', height: '22px', color: 'var(--status-error-text)' }}
                title="Log out"
              >
                <LogOut size={10} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '0.75rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Brand Mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={() => setActiveTab('catalog')}>
          <div style={{
            width: '28px',
            height: '28px',
            backgroundColor: 'var(--bg-dark)',
            color: 'var(--text-inverse)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '0.85rem',
            fontFamily: 'var(--font-mono)',
            borderRadius: '4px',
          }}>
            E
          </div>
          <div>
            <div style={{
              fontWeight: 800,
              fontSize: '1.05rem',
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
            }}>
              EVE <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>// HEALTHCARE</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 0.85rem',
                  borderRadius: 'var(--radius-full)',
                  border: isActive ? '1px solid var(--border-strong)' : '1px solid transparent',
                  backgroundColor: isActive ? 'var(--bg-dark)' : 'transparent',
                  color: isActive ? 'var(--text-inverse)' : 'var(--text-secondary)',
                  fontSize: '0.8125rem',
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  opacity: isActive ? 0.7 : 0.4,
                }}>
                  {tab.tag}
                </span>
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
