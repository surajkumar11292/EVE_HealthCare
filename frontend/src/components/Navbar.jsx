import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Stethoscope, User, Shield, LogOut, RefreshCw } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, onOpenAuthModal }) {
  const { user, isAuthenticated, isAdmin, switchPersona, logout } = useAuth();
  const [healthStatus, setHealthStatus] = useState('checking');

  useEffect(() => {
    let isMounted = true;
    async function checkHealth() {
      try {
        await api.getHealth();
        if (isMounted) setHealthStatus('online');
      } catch {
        if (isMounted) setHealthStatus('offline');
      }
    }
    checkHealth();
    const interval = setInterval(checkHealth, 20000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const navItems = [
    { id: 'catalog', label: 'Find Tests' },
    { id: 'bookings', label: 'My Appointments' },
    { id: 'payments', label: 'Pay Online' },
    { id: 'developer', label: 'Developer Sandbox' },
  ];

  return (
    <header style={{
      backgroundColor: '#FFFFFF',
      borderBottom: '1px solid var(--border-light)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: 'var(--shadow-xs)',
    }}>
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '0.75rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Brand Logo */}
        <div
          onClick={() => setActiveTab('catalog')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer' }}
        >
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--text-main)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Stethoscope size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-0.025em', lineHeight: 1.1 }}>
              EVE Healthcare
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Diagnostic Labs & Health Checkups
            </div>
          </div>
        </div>

        {/* Impeccable Pill Bar Navigation */}
        <nav className="impeccable-pill-bar">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`impeccable-pill-btn ${isActive ? 'active' : ''}`}
              >
                {isActive && <span className="dot green"></span>}
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User Account / Sign In */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {isAuthenticated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  {user.full_name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.35rem' }}>
                  <span className={`pill-badge ${isAdmin ? 'warning' : 'success'}`} style={{ padding: '0.05rem 0.4rem', fontSize: '0.65rem' }}>
                    <span className={`dot ${isAdmin ? 'amber' : 'green'}`}></span>
                    {isAdmin ? 'Administrator' : 'Patient'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => switchPersona(isAdmin ? 'PATIENT' : 'ADMIN')}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                title="Toggle between Patient and Administrator persona"
              >
                <RefreshCw size={11} />
                Switch to {isAdmin ? 'Patient' : 'Admin'}
              </button>

              <button
                onClick={logout}
                className="btn btn-ghost btn-sm"
                style={{ padding: '0.35rem 0.5rem', color: 'var(--status-error-text)' }}
                title="Sign out"
              >
                <LogOut size={13} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={() => switchPersona('PATIENT')}
                className="btn btn-ghost btn-sm"
              >
                Demo: Patient
              </button>
              <button
                onClick={onOpenAuthModal}
                className="btn btn-ink btn-sm"
              >
                Sign In
                <span className="arrow-gold">→</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
