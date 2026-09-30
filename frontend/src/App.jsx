import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import CatalogView from './components/CatalogView';
import BookingsView from './components/BookingsView';
import CartView from './components/CartView';
import CartConflictModal from './components/CartConflictModal';

function MainContent() {
  const [activeTab, setActiveTab] = useState('catalog');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authIntentMessage, setAuthIntentMessage] = useState(null);
  const [refreshBookingsTrigger, setRefreshBookingsTrigger] = useState(0);

  const { isAuthenticated } = useAuth();

  const handlePayBooking = (booking) => {
    // When user clicks Pay on an existing booking from My Appointments
    // we take them to Cart / Payments
    setActiveTab('cart');
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-page)' }}>
      {/* Top Navigation Bar with Cart Badge */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAuthModal={() => {
          setAuthIntentMessage(null);
          setIsAuthModalOpen(true);
        }}
      />

      {/* Main Page Content */}
      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.25rem 1.5rem' }}>
        {activeTab === 'catalog' && (
          <CatalogView onGoToCart={() => setActiveTab('cart')} />
        )}

        {activeTab === 'bookings' && (
          <BookingsView
            onPayBooking={handlePayBooking}
            refreshTrigger={refreshBookingsTrigger}
          />
        )}

        {activeTab === 'cart' && (
          <CartView
            onGoToCatalog={() => setActiveTab('catalog')}
            onGoToAppointments={() => {
              setRefreshBookingsTrigger(Date.now());
              setActiveTab('bookings');
            }}
            onOpenAuthModal={() => {
              setAuthIntentMessage('Please sign in to proceed with your diagnostic booking payment.');
              setIsAuthModalOpen(true);
            }}
          />
        )}
      </main>

      {/* Cart Conflict Modal (Triggers when adding test from different clinic) */}
      <CartConflictModal />

      {/* Small Popout Sign In Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setAuthIntentMessage(null);
        }}
        intentMessage={authIntentMessage}
        onLoginSuccess={() => {
          setIsAuthModalOpen(false);
          setAuthIntentMessage(null);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <MainContent />
      </CartProvider>
    </AuthProvider>
  );
}
