import React from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Shield, CheckCircle, ArrowRight, Key, Sparkles, RefreshCw } from 'lucide-react';

export default function PersonaBanner({ onOpenAuthModal }) {
  const { user, isAuthenticated, isAdmin, switchPersona, loading } = useAuth();

  return (
    <div className="card" style={{ marginBottom: '2rem', padding: '1.75rem', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1.5rem',
      }}>
        {/* Left: Current Active Identity */}
        <div>
          <div className="kicker" style={{ marginBottom: '0.35rem' }}>// ACTIVE IDENTITY CONTEXT</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: isAdmin ? '#FEF3C7' : '#DCFCE7',
              border: `1px solid ${isAdmin ? '#FDE68A' : '#BBF7D0'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isAdmin ? '#B45309' : '#15803D',
            }}>
              {isAdmin ? <Shield size={22} /> : <User size={22} />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <h2 style={{ fontSize: '1.35rem' }}>
                  {isAuthenticated ? user.full_name : 'Guest User'}
                </h2>
                <span className={`pill-badge ${isAdmin ? 'warning' : 'success'}`}>
                  <span className={`dot ${isAdmin ? 'amber' : 'green pulse'}`}></span>
                  {isAuthenticated ? user.role : 'UNAUTHENTICATED'}
                </span>
              </div>
              <div style={{
                fontSize: '0.8125rem',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                marginTop: '0.2rem',
              }}>
                {isAuthenticated ? (
                  <>
                    <span>{user.email}</span>
                    <span style={{ margin: '0 0.5rem' }}>·</span>
                    <span>ID: {user.id.substring(0, 8)}...</span>
                  </>
                ) : (
                  'No active session. Select a persona below to interact with the backend.'
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Manual Auth Modal trigger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={onOpenAuthModal}
            className="btn btn-ghost"
            style={{ fontSize: '0.8125rem' }}
          >
            <Key size={14} />
            {isAuthenticated ? 'Switch / Sign In' : 'Sign In / Register'}
          </button>
        </div>
      </div>

      {/* Quick Role Switcher Cards */}
      <div style={{
        marginTop: '1.5rem',
        paddingTop: '1.25rem',
        borderTop: '1px solid var(--border-light)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1rem',
      }}>
        {/* Patient Switcher Card */}
        <div
          onClick={() => switchPersona('PATIENT')}
          style={{
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            border: !isAdmin && isAuthenticated ? '2px solid var(--border-strong)' : '1px solid var(--border-light)',
            backgroundColor: !isAdmin && isAuthenticated ? '#FBFBFB' : 'var(--bg-surface)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="dot green"></span>
              <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Patient Persona: John Doe</span>
            </div>
            {!isAdmin && isAuthenticated && (
              <span className="pill-badge success" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                ACTIVE
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            Explore available diagnostic centres, book tests with price snapshotting, and simulate payment transitions.
          </p>
          <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            patient@evehealthcare.com · Patient@123456
          </div>
        </div>

        {/* Admin Switcher Card */}
        <div
          onClick={() => switchPersona('ADMIN')}
          style={{
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            border: isAdmin && isAuthenticated ? '2px solid var(--border-strong)' : '1px solid var(--border-light)',
            backgroundColor: isAdmin && isAuthenticated ? '#FBFBFB' : 'var(--bg-surface)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="dot amber"></span>
              <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Admin Persona: System Admin</span>
            </div>
            {isAdmin && isAuthenticated && (
              <span className="pill-badge warning" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                ACTIVE
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            Access global diagnostic test management, inspect all patient bookings, and simulate system-wide events.
          </p>
          <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            admin@evehealthcare.com · Admin@123456
          </div>
        </div>
      </div>
    </div>
  );
}
