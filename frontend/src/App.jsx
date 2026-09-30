import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import PersonaBanner from './components/PersonaBanner';
import AuthModal from './components/AuthModal';
import CatalogView from './components/CatalogView';
import BookingsView from './components/BookingsView';
import BookingModal from './components/BookingModal';
import PaymentsView from './components/PaymentsView';
import WebhookSandbox from './components/WebhookSandbox';
import TelemetryView from './components/TelemetryView';

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

        {activeTab === 'webhooks' && (
          <WebhookSandbox
            initialBooking={selectedWebhookBooking}
          />
        )}

        {activeTab === 'telemetry' && (
          <TelemetryView />
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
