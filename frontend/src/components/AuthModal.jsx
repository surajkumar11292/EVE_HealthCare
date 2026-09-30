import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, User, Shield, Mail, Lock, Phone, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';

export default function AuthModal({ isOpen, onClose, intentMessage, onLoginSuccess }) {
  const { login, signup, switchPersona } = useAuth();
  const [tab, setTab] = useState('login'); // 'login' | 'signup'
  const [loading, setLoading] = useState(false);
  const [quickLoginRole, setQuickLoginRole] = useState(null);
  const [error, setError] = useState(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState('PATIENT');

  if (!isOpen) return null;

  // One-click pre-seed & instant sign in
  const handleQuickSignIn = async (targetRole) => {
    setLoading(true);
    setQuickLoginRole(targetRole);
    setError(null);

    const targetEmail = targetRole === 'ADMIN' ? 'admin@evehealthcare.com' : 'patient@evehealthcare.com';
    const targetPassword = targetRole === 'ADMIN' ? 'Admin@123456' : 'Patient@123456';

    setEmail(targetEmail);
    setPassword(targetPassword);

    try {
      const loggedUser = await switchPersona(targetRole);
      if (onLoginSuccess) {
        onLoginSuccess(loggedUser);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Quick login failed. Please try again.');
    } finally {
      setLoading(false);
      setQuickLoginRole(null);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const loggedUser = await login(email, password);
      if (onLoginSuccess) {
        onLoginSuccess(loggedUser);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Unable to sign in. Please verify your email and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const loggedUser = await signup({
        email,
        password,
        full_name: fullName,
        phone_number: phoneNumber || null,
        role,
      });
      if (onLoginSuccess) {
        onLoginSuccess(loggedUser);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Registration failed. Check password rules.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.25rem 1rem',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text-main)' }}>
              {tab === 'login' ? 'Sign In' : 'Create Account'}
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              {intentMessage || (tab === 'login' ? 'Access your appointments and diagnostic reports' : 'Register to book appointments')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ padding: '0.25rem', border: 'none' }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '1.25rem' }}>
          {error && (
            <div style={{
              padding: '0.65rem 0.85rem',
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
              <span>{error}</span>
            </div>
          )}

          {tab === 'login' && (
            <>
              {/* 1-Click Pre-seeded Instant Login Box */}
              <div style={{
                marginBottom: '1.25rem',
                padding: '0.85rem',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-light)',
              }}>
                <div style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--text-muted)',
                  marginBottom: '0.65rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}>
                  <Zap size={12} color="var(--accent-gold)" />
                  1-Click Instant Login (Pre-seeded):
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {/* Patient Button */}
                  <button
                    type="button"
                    onClick={() => handleQuickSignIn('PATIENT')}
                    disabled={loading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.65rem 0.85rem',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--text-main)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-light)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: '#ECFDF5',
                        color: '#059669',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <User size={14} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-main)' }}>
                          Patient: John Doe
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          patient@evehealthcare.com
                        </div>
                      </div>
                    </div>

                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: quickLoginRole === 'PATIENT' ? 'var(--accent-gold)' : 'var(--text-main)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                    }}>
                      {quickLoginRole === 'PATIENT' ? 'Signing In...' : 'Sign In →'}
                    </span>
                  </button>

                  {/* Admin Button */}
                  <button
                    type="button"
                    onClick={() => handleQuickSignIn('ADMIN')}
                    disabled={loading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.65rem 0.85rem',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--text-main)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-light)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: '#FFFBEB',
                        color: '#D97706',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <Shield size={14} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-main)' }}>
                          Administrator: System Admin
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          admin@evehealthcare.com
                        </div>
                      </div>
                    </div>

                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: quickLoginRole === 'ADMIN' ? 'var(--accent-gold)' : 'var(--text-main)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                    }}>
                      {quickLoginRole === 'ADMIN' ? 'Signing In...' : 'Sign In →'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                margin: '1rem 0',
                color: 'var(--text-faint)',
                fontSize: '0.75rem',
              }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-light)' }}></div>
                <span>or enter credentials</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-light)' }}></div>
              </div>

              {/* Standard Form */}
              <form onSubmit={handleLoginSubmit}>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@evehealthcare.com"
                      className="form-input"
                      style={{ paddingLeft: '2rem' }}
                    />
                    <Mail size={13} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label">Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="form-input"
                      style={{ paddingLeft: '2rem' }}
                    />
                    <Lock size={13} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-ink"
                  style={{ width: '100%', padding: '0.65rem' }}
                >
                  {loading && !quickLoginRole ? 'Signing In...' : 'Sign In'}
                  <span className="arrow-gold">→</span>
                </button>
              </form>
            </>
          )}

          {tab === 'signup' && (
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
                  placeholder="Min 8 characters"
                  className="form-input"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="form-select"
                >
                  <option value="PATIENT">Patient Account</option>
                  <option value="ADMIN">Administrator</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-ink"
                style={{ width: '100%', padding: '0.65rem' }}
              >
                {loading ? 'Creating...' : 'Register Account'}
                <span className="arrow-gold">→</span>
              </button>
            </form>
          )}

          {/* Tab Switcher Link */}
          <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {tab === 'login' ? (
              <span>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setTab('signup'); setError(null); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Register
                </button>
              </span>
            ) : (
              <span>
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => { setTab('login'); setError(null); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Sign In
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
