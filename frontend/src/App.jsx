import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import PersonaBanner from './components/PersonaBanner';
import AuthModal from './components/AuthModal';
import CatalogView from './components/CatalogView';
import BookingsView from './components/BookingsView';
import BookingModal from './components/BookingModal';
import PaymentsView from './components/PaymentsView';

function MainContent() {
  const [activeTab, setActiveTab] = useState('catalog');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedBookingContext, setSelectedBookingContext] = useState(null);
  const [selectedPayBooking, setSelectedPayBooking] = useState(null);
  const [selectedWebhookBooking, setSelectedWebhookBooking] = useState(null);
  const [refreshBookingsTrigger, setRefreshBookingsTrigger] = useState(0);

  const { user, isAuthenticated, isAdmin } = useAuth();

  const handleBookTestClick = (centre, centreTest) => {
    setSelectedBookingContext({ centre, centreTest });
    setIsBookingModalOpen(true);
  };

  const handleBookingCreated = (newBooking) => {
    setRefreshBookingsTrigger(Date.now());
    setActiveTab('bookings');
  };

  const handlePayBooking = (booking) => {
    setSelectedPayBooking(booking);
    setActiveTab('payments');
  };

  const handleOpenWebhook = (booking) => {
    setSelectedWebhookBooking(booking);
    setActiveTab('webhooks');
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

        {activeTab === 'bookings' && (
          <BookingsView
            onPayBooking={handlePayBooking}
            onOpenWebhook={handleOpenWebhook}
            refreshTrigger={refreshBookingsTrigger}
          />
        )}

        {activeTab === 'payments' && (
          <PaymentsView
            initialBooking={selectedPayBooking}
            onPaymentSuccess={(result) => {
              setRefreshBookingsTrigger(Date.now());
            }}
          />
        )}

        {activeTab !== 'catalog' && activeTab !== 'bookings' && activeTab !== 'payments' && (
          <div className="card" style={{ padding: '2.5rem', textAlign: 'center', backgroundColor: '#FFFFFF' }}>
            <div className="kicker" style={{ marginBottom: '0.5rem' }}>// CURRENT VIEW: {activeTab.toUpperCase()}</div>
            <h2 style={{ fontSize: '1.35rem', marginBottom: '0.75rem' }}>
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
              {selectedPayBooking && activeTab === 'payments' ? (
                <>Selected Booking for payment: <strong>{selectedPayBooking.test_name}</strong> (Amount: ₹{selectedPayBooking.amount}). Ready for Phase 5!</>
              ) : selectedWebhookBooking && activeTab === 'webhooks' ? (
                <>Selected Booking for webhook verification: <strong>{selectedWebhookBooking.id}</strong>. Ready for Phase 6!</>
              ) : (
                'Navigate back to Bookings Ledger or Catalog to schedule appointments and test state machine transitions.'
              )}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
              <button onClick={() => setActiveTab('bookings')} className="btn btn-ghost btn-sm">
                View Bookings Ledger
              </button>
              <button onClick={() => setActiveTab('catalog')} className="btn btn-ink btn-sm">
                Back to Catalog Matrix
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Appointment Scheduling Modal */}
      {selectedBookingContext && (
        <BookingModal
          isOpen={isBookingModalOpen}
          onClose={() => setIsBookingModalOpen(false)}
          centre={selectedBookingContext.centre}
          centreTest={selectedBookingContext.centreTest}
          onBookingCreated={handleBookingCreated}
        />
      )}

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
