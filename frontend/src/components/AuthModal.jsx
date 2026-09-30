import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, User, Mail, Lock, Phone, Shield, ArrowRight } from 'lucide-react';

export default function AuthModal({ isOpen, onClose }) {
  const { login, signup, switchPersona } = useAuth();
  const [tab, setTab] = useState('login'); // 'login' | 'signup'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState('PATIENT');

  if (!isOpen) return null;

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      onClose();
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signup({
        email,
        password,
        full_name: fullName,
        phone_number: phoneNumber || null,
        role,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Registration failed. Check password requirements.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (targetRole) => {
    if (targetRole === 'ADMIN') {
      setEmail('admin@evehealthcare.com');
      setPassword('Admin@123456');
    } else {
      setEmail('patient@evehealthcare.com');
      setPassword('Patient@123456');
    }
    setError(null);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div className="kicker">// SECURITY & ACCESS</div>
            <h3 style={{ fontSize: '1.15rem', marginTop: '0.15rem' }}>
              {tab === 'login' ? 'Authenticate Session' : 'Register New Account'}
            </h3>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: '0.25rem' }}>
            <X size={16} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-light)',
          backgroundColor: 'var(--bg-subtle)',
        }}>
          <button
            onClick={() => { setTab('login'); setError(null); }}
            style={{
              flex: 1,
              padding: '0.65rem 1rem',
              border: 'none',
              background: tab === 'login' ? 'var(--bg-surface)' : 'transparent',
              fontWeight: tab === 'login' ? 600 : 500,
              fontSize: '0.8125rem',
              borderBottom: tab === 'login' ? '2px solid var(--border-strong)' : 'none',
              cursor: 'pointer',
              color: tab === 'login' ? 'var(--text-main)' : 'var(--text-muted)',
            }}
          >
            Sign In
          </button>
          <button
            onClick={() => { setTab('signup'); setError(null); }}
            style={{
              flex: 1,
              padding: '0.65rem 1rem',
              border: 'none',
              background: tab === 'signup' ? 'var(--bg-surface)' : 'transparent',
              fontWeight: tab === 'signup' ? 600 : 500,
              fontSize: '0.8125rem',
              borderBottom: tab === 'signup' ? '2px solid var(--border-strong)' : 'none',
              cursor: 'pointer',
              color: tab === 'signup' ? 'var(--text-main)' : 'var(--text-muted)',
            }}
          >
            Create Account
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem' }}>
          {error && (
            <div style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--status-error-bg)',
              border: '1px solid var(--status-error-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--status-error-text)',
              fontSize: '0.8125rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <span className="dot rose"></span>
              {error}
            </div>
          )}

          {tab === 'login' ? (
            <form onSubmit={handleLoginSubmit}>
              {/* Quick Fill Helper */}
              <div style={{
                marginBottom: '1.25rem',
                padding: '0.75rem',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-light)',
              }}>
                <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  QUICK PRESETS (PRE-SEEDED CREDENTIALS):
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => handleQuickFill('PATIENT')}
                    className="btn btn-ghost btn-sm"
                    style={{ flex: 1, fontSize: '0.75rem', backgroundColor: 'var(--bg-surface)' }}
                  >
                    👤 Patient Preset
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickFill('ADMIN')}
                    className="btn btn-ghost btn-sm"
                    style={{ flex: 1, fontSize: '0.75rem', backgroundColor: 'var(--bg-surface)' }}
                  >
                    🛡️ Admin Preset
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. patient@evehealthcare.com"
                    className="form-input"
                    style={{ paddingLeft: '2rem' }}
                  />
                  <Mail size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="form-input"
                    style={{ paddingLeft: '2rem' }}
                  />
                  <Lock size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-ink"
                style={{ width: '100%', marginTop: '0.5rem' }}
              >
                {loading ? 'Authenticating...' : 'Sign In'}
                <ArrowRight size={14} />
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignupSubmit}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 chars, 1 uppercase, 1 digit, 1 special"
                  className="form-input"
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Must contain uppercase, lowercase, number, and special character.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number (Optional)</label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+919876543210"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Account Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="form-select"
                >
                  <option value="PATIENT">Patient (Standard Booking Access)</option>
                  <option value="ADMIN">Administrator (Full Diagnostic & System Management)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-ink"
                style={{ width: '100%', marginTop: '0.5rem' }}
              >
                {loading ? 'Creating Account...' : 'Complete Registration'}
                <ArrowRight size={14} />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
