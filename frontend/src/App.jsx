import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import PersonaBanner from './components/PersonaBanner';
import AuthModal from './components/AuthModal';
import CatalogView from './components/CatalogView';

function MainContent() {
  const [activeTab, setActiveTab] = useState('catalog');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [selectedBookingContext, setSelectedBookingContext] = useState(null);
  const { user, isAuthenticated, isAdmin } = useAuth();

  const handleBookTestClick = (centre, centreTest) => {
    setSelectedBookingContext({ centre, centreTest });
    // In Phase 4 this opens the booking modal; for now switch tab or alert
    setActiveTab('bookings');
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-canvas)' }}>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
        {/* Persona & Identity Context Banner */}
        <PersonaBanner onOpenAuthModal={() => setIsAuthModalOpen(true)} />

        {/* Dynamic Tab Views */}
        {activeTab === 'catalog' && (
          <CatalogView onBookTest={handleBookTestClick} />
        )}

        {activeTab !== 'catalog' && (
          <div className="card" style={{ padding: '2.5rem', textAlign: 'center', backgroundColor: '#FFFFFF' }}>
            <div className="kicker" style={{ marginBottom: '0.5rem' }}>// CURRENT VIEW: {activeTab.toUpperCase()}</div>
            <h2 style={{ fontSize: '1.35rem', marginBottom: '0.75rem' }}>
              {activeTab === 'bookings' && 'Diagnostic Bookings Ledger (Phase 4)'}
              {activeTab === 'payments' && 'Simulated Payment Gateway & Idempotency (Phase 5)'}
              {activeTab === 'webhooks' && 'Payment Webhook Testing Sandbox & Concurrency Lab (Phase 6)'}
              {activeTab === 'telemetry' && 'System Architecture & Telemetry (Phase 7)'}
            </h2>
            <p style={{
              color: 'var(--text-secondary)',
              maxWidth: '650px',
              margin: '0 auto 1.5rem',
              fontSize: '0.875rem',
              lineHeight: 1.6,
            }}>
              {selectedBookingContext ? (
                <>Selected test: <strong>{selectedBookingContext.centreTest?.test?.name}</strong> at <strong>{selectedBookingContext.centre?.name}</strong> (₹{selectedBookingContext.centreTest?.price}). Ready to connect with Phase 4 booking scheduler!</>
              ) : (
                'Select "Catalog Matrix" in the header to browse diagnostic centres and tests with real-time price snapshotting.'
              )}
            </p>
            <button onClick={() => setActiveTab('catalog')} className="btn btn-ink btn-sm">
              Back to Catalog Matrix
            </button>
          </div>
        )}
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
