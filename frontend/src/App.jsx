import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import CatalogView from './components/CatalogView';
import BookingsView from './components/BookingsView';
import BookingModal from './components/BookingModal';
import PaymentsView from './components/PaymentsView';
import DeveloperSandbox from './components/DeveloperSandbox';

function MainContent() {
  const [activeTab, setActiveTab] = useState('catalog');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedBookingContext, setSelectedBookingContext] = useState(null);
  const [pendingBookingContext, setPendingBookingContext] = useState(null);
  const [authIntentMessage, setAuthIntentMessage] = useState(null);
  const [selectedPayBooking, setSelectedPayBooking] = useState(null);
  const [refreshBookingsTrigger, setRefreshBookingsTrigger] = useState(0);

  const { user, isAuthenticated, isAdmin } = useAuth();

  // Workflow fix: if unauthenticated, intercept and pop out small login modal
  const handleBookTestClick = (centre, centreTest) => {
    if (!isAuthenticated) {
      setPendingBookingContext({ centre, centreTest });
      setAuthIntentMessage(`Please sign in to book your diagnostic appointment at ${centre.name}.`);
      setIsAuthModalOpen(true);
      return;
    }
    setSelectedBookingContext({ centre, centreTest });
    setIsBookingModalOpen(true);
  };

  // When login completes (via 1-click or credentials), resume booking if pending
  const handleLoginSuccess = () => {
    if (pendingBookingContext) {
      setSelectedBookingContext(pendingBookingContext);
      setPendingBookingContext(null);
      setAuthIntentMessage(null);
      setIsBookingModalOpen(true);
    }
  };

  const handleBookingCreated = (newBooking) => {
    setRefreshBookingsTrigger(Date.now());
    setActiveTab('bookings');
  };

  const handlePayBooking = (booking) => {
    setSelectedPayBooking(booking);
    setActiveTab('payments');
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-page)' }}>
      {/* Top Navigation with Impeccable styling */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAuthModal={() => {
          setAuthIntentMessage(null);
          setIsAuthModalOpen(true);
        }}
      />

      {/* Main Page Content */}
      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '2.5rem 1.5rem' }}>
        {activeTab === 'catalog' && (
          <CatalogView onBookTest={handleBookTestClick} />
        )}

        {activeTab === 'bookings' && (
          <BookingsView
            onPayBooking={handlePayBooking}
            refreshTrigger={refreshBookingsTrigger}
          />
        )}

        {activeTab === 'payments' && (
          <PaymentsView
            initialBooking={selectedPayBooking}
            onPaymentSuccess={() => {
              setRefreshBookingsTrigger(Date.now());
            }}
          />
        )}

        {activeTab === 'developer' && (
          <DeveloperSandbox />
        )}
      </main>

      {/* Schedule Appointment Modal */}
      {selectedBookingContext && (
        <BookingModal
          isOpen={isBookingModalOpen}
          onClose={() => {
            setIsBookingModalOpen(false);
            setSelectedBookingContext(null);
          }}
          centre={selectedBookingContext.centre}
          centreTest={selectedBookingContext.centreTest}
          onBookingCreated={handleBookingCreated}
        />
      )}

      {/* Small Popout Sign In Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setAuthIntentMessage(null);
        }}
        intentMessage={authIntentMessage}
        onLoginSuccess={handleLoginSuccess}
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
