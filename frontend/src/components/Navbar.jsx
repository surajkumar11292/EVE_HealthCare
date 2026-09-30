import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { Stethoscope, User, LogOut, ChevronDown, Check, RefreshCw, ShoppingCart } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, onOpenAuthModal }) {
  const { user, isAuthenticated, isAdmin, switchPersona, logout } = useAuth();
  const { cartItems } = useCart();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    { id: 'catalog', label: 'Find Clinics' },
    { id: 'bookings', label: 'My Appointments' },
    { id: 'cart', label: 'Cart', badge: cartItems.length > 0 ? cartItems.length : null },
  ];

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <header style={{
      backgroundColor: 'rgba(250, 248, 242, 0.95)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-light)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: 'var(--shadow-xs)',
    }}>
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '0.65rem 1.5rem',
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
            <div style={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-0.025em', lineHeight: 1.1, color: 'var(--text-main)' }}>
              EVE Healthcare
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Diagnostic Labs & Health Checkups
            </div>
          </div>
        </div>

        {/* Floating Pill Bar Navigation (No dots, real healthcare tabs) */}
        <nav className="impeccable-pill-bar">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`impeccable-pill-btn ${isActive ? 'active' : ''}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <span>{item.label}</span>
                {item.badge != null && (
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      lineHeight: 1,
                      padding: '0.15rem 0.4rem',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: isActive ? 'var(--accent-gold)' : 'var(--text-main)',
                      color: isActive ? 'var(--text-main)' : '#FFFFFF',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Real-Life Account Profile / Sign In */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {isAuthenticated ? (
            <div style={{ position: 'relative' }} ref={dropdownRef}>
              {/* Clean User Profile Trigger Button */}
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.35rem 0.65rem 0.35rem 0.4rem',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'var(--bg-surface)',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                <div style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  backgroundColor: isAdmin ? 'var(--text-main)' : '#F3EFE6',
                  color: isAdmin ? '#FFFFFF' : 'var(--text-main)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {getInitials(user.full_name)}
                </div>
                <div style={{ textAlign: 'left', lineHeight: 1.1 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    {user.full_name}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    {isAdmin ? 'Admin' : 'Patient'}
                  </div>
                </div>
                <ChevronDown size={14} style={{ color: 'var(--text-muted)', marginLeft: '0.2rem' }} />
              </button>

              {/* Profile Dropdown Menu */}
              {isDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 8px)',
                  width: '240px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-light)',
                  boxShadow: 'var(--shadow-lg)',
                  padding: '0.5rem',
                  zIndex: 200,
                  animation: 'fadeIn 0.12s ease-out',
                }}>
                  {/* Account Header */}
                  <div style={{
                    padding: '0.65rem 0.75rem',
                    borderBottom: '1px solid var(--border-light)',
                    marginBottom: '0.35rem',
                  }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main)' }}>
                      {user.full_name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                      {user.email}
                    </div>
                    <div style={{ marginTop: '0.4rem' }}>
                      <span className={`pill-badge ${isAdmin ? 'warning' : 'success'}`} style={{ padding: '0.1rem 0.5rem', fontSize: '0.68rem' }}>
                        {isAdmin ? 'Administrator Portal' : 'Patient Account'}
                      </span>
                    </div>
                  </div>

                  {/* Sign Out */}
                  <button
                    onClick={() => {
                      logout();
                      setIsDropdownOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      fontSize: '0.8125rem',
                      color: 'var(--status-error-text)',
                      background: 'none',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--status-error-bg)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <LogOut size={13} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
