import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, User, Shield, Mail, Lock, CheckCircle2, ArrowRight } from 'lucide-react';

const PRESEEDED_ACCOUNTS = [
  {
    id: 'patient1',
    role: 'PATIENT',
    name: 'Suraj Kumar',
    subtitle: 'Patient #1 (Cardiology & CBC)',
    email: 'patient@evehealthcare.com',
    password: 'Patient@123456',
    color: '#059669',
    bgColor: '#ECFDF5',
  },
  {
    id: 'patient2',
    role: 'PATIENT',
    name: 'Ananya Sharma',
    subtitle: 'Patient #2 (Thyroid & Vitamins)',
    email: 'patient2@evehealthcare.com',
    password: 'Patient@123456',
    color: '#0284C7',
    bgColor: '#F0F9FF',
  },
  {
    id: 'patient3',
    role: 'PATIENT',
    name: 'Rajesh Patel',
    subtitle: 'Patient #3 (Diabetic Care & KFT)',
    email: 'patient3@evehealthcare.com',
    password: 'Patient@123456',
    color: '#7C3AED',
    bgColor: '#F5F3FF',
  },
  {
    id: 'admin',
    role: 'ADMIN',
    name: 'Dr. Rohan Mehra',
    subtitle: 'Administrator (Chief Lab Admin)',
    email: 'admin@evehealthcare.com',
    password: 'Admin@123456',
    color: '#D97706',
    bgColor: '#FFFBEB',
  },
];

export default function AuthModal({ isOpen, onClose, intentMessage, onLoginSuccess }) {
  const { login, signup } = useAuth();
  const [tab, setTab] = useState('login'); // 'login' | 'signup'
  const [loading, setLoading] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [fillNotice, setFillNotice] = useState(null);
  const [error, setError] = useState(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('PATIENT');

  if (!isOpen) return null;

  // 1-Tap Fill: Fills email & password without auto-submitting
  const handleTapToFill = (acc) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setSelectedAccountId(acc.id);
    setError(null);
    setFillNotice(`Credentials loaded for ${acc.name}. Click "Sign In" below to proceed.`);
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
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '440px', maxHeight: '92vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.25rem 1rem',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text-main)', margin: 0 }}>
              {tab === 'login' ? 'Sign In' : 'Create Account'}
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.2rem', margin: 0 }}>
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
            }}>
              {error}
            </div>
          )}

          {tab === 'login' && (
            <>
              {/* 1-Tap Fill Credentials Box */}
              <div style={{
                marginBottom: '1.15rem',
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
                  marginBottom: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <span>Demo Accounts (1-Tap Fill)</span>
                  <span style={{ fontSize: '0.68rem', fontWeight: 400 }}>Tap to fill fields</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.45rem' }}>
                  {PRESEEDED_ACCOUNTS.map((acc) => {
                    const isSelected = selectedAccountId === acc.id;
                    const isRoleAdmin = acc.role === 'ADMIN';

                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => handleTapToFill(acc)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          padding: '0.55rem 0.65rem',
                          backgroundColor: isSelected ? '#FFFFFF' : '#FFFFFF',
                          border: isSelected ? '1.5px solid var(--text-main)' : '1px solid var(--border-light)',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease',
                          position: 'relative',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                          <div style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: acc.bgColor,
                            color: acc.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            {isRoleAdmin ? <Shield size={11} /> : <User size={11} />}
                          </div>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {acc.name}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {acc.email}
                        </div>

                        {isSelected && (
                          <div style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                          }}>
                            <CheckCircle2 size={12} color="var(--accent-gold)" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {fillNotice && (
                  <div style={{
                    marginTop: '0.65rem',
                    fontSize: '0.75rem',
                    color: 'var(--accent-gold)',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}>
                    <CheckCircle2 size={12} />
                    <span>{fillNotice}</span>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                margin: '0.85rem 0',
                color: 'var(--text-faint)',
                fontSize: '0.72rem',
              }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-light)' }}></div>
                <span>sign in credentials</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-light)' }}></div>
              </div>

              {/* Standard Form */}
              <form onSubmit={handleLoginSubmit}>
                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label className="form-label">Email Address</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setSelectedAccountId(null);
                        setFillNotice(null);
                      }}
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
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setSelectedAccountId(null);
                        setFillNotice(null);
                      }}
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
                  style={{ width: '100%', padding: '0.68rem', fontSize: '0.875rem' }}
                >
                  {loading ? 'Signing In...' : 'Sign In'}
                  <span className="arrow-gold">→</span>
                </button>
              </form>
            </>
          )}

          {tab === 'signup' && (
            <form onSubmit={handleSignupSubmit}>
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
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

              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
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

              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="form-label">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 chars, 1 uppercase, 1 digit, 1 special"
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
                style={{ width: '100%', padding: '0.68rem', fontSize: '0.875rem' }}
              >
                {loading ? 'Creating Account...' : 'Register Account'}
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
