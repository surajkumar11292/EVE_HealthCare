import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import PersonaBanner from './components/PersonaBanner';
import AuthModal from './components/AuthModal';

function MainContent() {
  const [activeTab, setActiveTab] = useState('catalog');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { user, isAuthenticated, isAdmin } = useAuth();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-canvas)' }}>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
        {/* Persona & Identity Context Banner */}
        <PersonaBanner onOpenAuthModal={() => setIsAuthModalOpen(true)} />

        {/* Phase 2 Verification Status Card */}
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center', backgroundColor: '#FFFFFF' }}>
          <div className="kicker" style={{ marginBottom: '0.5rem' }}>// AUTHENTICATION & ROLE-BASED ACCESS CONTROL</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>
            {isAuthenticated ? `Welcome back, ${user.full_name}` : 'Authentication Engine Ready'}
          </h2>
          <p style={{
            color: 'var(--text-secondary)',
            maxWidth: '650px',
            margin: '0 auto 1.5rem',
            fontSize: '0.875rem',
            lineHeight: 1.6,
          }}>
            Your session is authenticated via JWT tokens with bcrypt password verification.
            Click the preset cards above to seamlessly switch between <strong>John Doe (Patient)</strong> and <strong>System Administrator (Admin)</strong> to preview different role permissions.
          </p>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '1rem',
            padding: '0.75rem 1.25rem',
            backgroundColor: 'var(--bg-subtle)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)',
            fontSize: '0.8125rem',
            fontFamily: 'var(--font-mono)',
          }}>
            <span>ACTIVE ROLE: <strong>{user?.role || 'NONE'}</strong></span>
            <span>·</span>
            <span>TOKEN: <strong>{localStorage.getItem('eve_auth_token') ? 'PRESENT' : 'ABSENT'}</strong></span>
            <span>·</span>
            <span>SECURITY: <strong>HMAC-SHA256 JWT</strong></span>
          </div>
        </div>
      </main>

      {/* Manual Login / Signup Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}
