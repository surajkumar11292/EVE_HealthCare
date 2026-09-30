import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  ShoppingCart,
  Trash2,
  Calendar,
  Clock,
  CreditCard,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Lock,
  ArrowRight,
  Sun,
  Moon,
  Building2,
  MapPin,
  Phone,
  FileText,
} from 'lucide-react';

const MORNING_SLOTS = [
  { label: '08:00 AM', hour: 8, minute: 0 },
  { label: '09:00 AM', hour: 9, minute: 0 },
  { label: '10:00 AM', hour: 10, minute: 0 },
  { label: '11:00 AM', hour: 11, minute: 0 },
];

const AFTERNOON_SLOTS = [
  { label: '02:00 PM', hour: 14, minute: 0 },
  { label: '03:30 PM', hour: 15, minute: 30 },
  { label: '04:30 PM', hour: 16, minute: 30 },
  { label: '06:00 PM', hour: 18, minute: 0 },
];

export default function CartView({ onGoToCatalog, onGoToAppointments, onOpenAuthModal }) {
  const { cartItems, cartCentre, removeFromCart, clearCart, totalAmount } = useCart();
  const { isAuthenticated } = useAuth();

  // Date & Slot state
  const formatDateISO = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getUpcomingDays = () => {
    const days = [];
    for (let i = 1; i <= 4; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const isTomorrow = i === 1;
      const dayLabel = isTomorrow ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' });
      const dateFormatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      days.push({
        iso: formatDateISO(d),
        label: `${dayLabel}, ${dateFormatted}`,
      });
    }
    return days;
  };

  const upcomingDays = getUpcomingDays();
  const [selectedDate, setSelectedDate] = useState(upcomingDays[0].iso);
  const [selectedSlot, setSelectedSlot] = useState(MORNING_SLOTS[2]); // 10:00 AM
  const [notes, setNotes] = useState('');

  // Payment states
  const [simulationMode, setSimulationMode] = useState('FORCE_SUCCESS'); // 'FORCE_SUCCESS' | 'FORCE_FAILED'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastPaymentResult, setLastPaymentResult] = useState(null);

  // Compute readable appointment summary
  const getReadableSummary = () => {
    if (!selectedDate || !selectedSlot) return '';
    try {
      const [year, month, day] = selectedDate.split('-').map(Number);
      const d = new Date(year, month - 1, day, selectedSlot.hour, selectedSlot.minute);
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }) + ` at ${selectedSlot.label}`;
    } catch {
      return `${selectedDate} at ${selectedSlot.label}`;
    }
  };

  // Process checkout & payment
  const handleCheckoutAndPay = async () => {
    if (!isAuthenticated) {
      onOpenAuthModal();
      return;
    }

    if (cartItems.length === 0) {
      setError('Your cart is empty.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [year, month, day] = selectedDate.split('-').map(Number);
      const appointmentDateTime = new Date(year, month - 1, day, selectedSlot.hour, selectedSlot.minute, 0);

      // 1. If user chose "Simulate Decline", simulate real decline
      if (simulationMode === 'FORCE_FAILED') {
        // Create 1 booking to attach failed transaction
        const firstItem = cartItems[0];
        const booking = await api.createBooking({
          centre_test_id: firstItem.id,
          appointment_time: appointmentDateTime.toISOString(),
          notes: notes.trim() || null,
        });

        const key = 'idem_fail_' + Math.random().toString(36).substring(2, 9);
        const payRes = await api.createPayment({
          booking_id: booking.id,
          idempotency_key: key,
          force_status: 'FAILED',
        });

        setLastPaymentResult({
          status: 'DECLINED',
          amount: totalAmount,
          transaction_id: payRes.transaction_id || `TXN-DECLINED-${Date.now().toString().slice(-6)}`,
          centre_name: cartCentre.name,
          tests: [...cartItems],
        });
        setError('Payment Failed — The card was declined by issuing bank. Please verify your details or switch simulation mode and retry.');
        return;
      }

      // 2. Success path: Book all items in cart and pay them
      const completedBookings = [];
      const txnId = 'TXN-' + Math.random().toString(36).substring(2, 8).toUpperCase() + Date.now().toString(36).toUpperCase();

      for (const item of cartItems) {
        // Create booking in database
        const booking = await api.createBooking({
          centre_test_id: item.id,
          appointment_time: appointmentDateTime.toISOString(),
          notes: notes.trim() || null,
        });

        // Pay booking in database
        const idempotencyKey = 'pay_' + booking.id + '_' + Date.now();
        await api.createPayment({
          booking_id: booking.id,
          idempotency_key: idempotencyKey,
          force_status: 'SUCCESS',
        });

        completedBookings.push(booking);
      }

      // Record receipt with exact cart total and items
      const receiptData = {
        status: 'SUCCESS',
        amount: totalAmount,
        transaction_id: txnId,
        centre_name: cartCentre.name,
        centre_location: cartCentre.location,
        appointment_summary: getReadableSummary(),
        tests: [...cartItems],
        paid_at: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      };

      setLastPaymentResult(receiptData);
      clearCart();
    } catch (err) {
      setError(err.message || 'Payment could not be completed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // RECEIPT SCREEN AFTER SUCCESSFUL PAYMENT
  // -------------------------------------------------------------
  if (lastPaymentResult && lastPaymentResult.status === 'SUCCESS') {
    return (
      <div style={{ maxWidth: '640px', margin: '1rem auto' }}>
        <div className="card" style={{ padding: '2rem', backgroundColor: '#FFFFFF' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: '#ECFDF5',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.75rem',
            }}>
              <CheckCircle2 size={28} />
            </div>
            <span className="pill-badge success" style={{ fontSize: '0.72rem', padding: '0.2rem 0.65rem' }}>
              PAID & CONFIRMED
            </span>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.5rem', marginBottom: '0.25rem' }}>
              Payment Verified & Booking Confirmed
            </h1>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
              Your diagnostic appointment has been successfully scheduled.
            </p>
          </div>

          {/* Receipt Card Breakdown */}
          <div style={{
            padding: '1.25rem',
            backgroundColor: 'var(--bg-subtle)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)',
            marginBottom: '1.5rem',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1rem', fontSize: '0.8125rem' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Reference Transaction</span>
                <span style={{ fontWeight: 600, color: 'var(--text-main)', fontFamily: 'monospace' }}>
                  {lastPaymentResult.transaction_id}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Total Amount Paid</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  ₹{parseFloat(lastPaymentResult.amount).toFixed(2)}
                </span>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Diagnostic Clinic</span>
                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                  {lastPaymentResult.centre_name}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>
                  {lastPaymentResult.centre_location}
                </span>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Appointment Slot</span>
                <span style={{ fontWeight: 600, color: '#047857' }}>
                  {lastPaymentResult.appointment_summary}
                </span>
              </div>
            </div>

            {/* Itemized Tests */}
            <div style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Diagnostic Tests Included:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {lastPaymentResult.tests.map((t, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--text-main)' }}>{t.name}</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>₹{parseFloat(t.price).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => {
                setLastPaymentResult(null);
                onGoToCatalog();
              }}
              className="btn btn-ghost"
              style={{ flex: 1 }}
            >
              Book Another Test
            </button>
            <button
              onClick={() => {
                setLastPaymentResult(null);
                onGoToAppointments();
              }}
              className="btn btn-ink"
              style={{ flex: 1.2 }}
            >
              View in My Appointments →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // EMPTY CART STATE
  // -------------------------------------------------------------
  if (cartItems.length === 0) {
    return (
      <div style={{ maxWidth: '640px', margin: '2.5rem auto', textAlign: 'center' }}>
        <div className="card" style={{ padding: '3.5rem 2rem', backgroundColor: '#FFFFFF' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--bg-subtle)',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
          }}>
            <ShoppingCart size={28} />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 0.45rem' }}>
            Your Cart is Empty
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: '360px', margin: '0 auto 1.5rem' }}>
            Select an accredited clinic, choose your diagnostic tests or health packages, and schedule your appointment.
          </p>
          <button
            onClick={onGoToCatalog}
            className="btn btn-ink"
            style={{ padding: '0.65rem 1.25rem', fontSize: '0.875rem' }}
          >
            Browse Diagnostic Clinics →
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // ACTIVE CART & CHECKOUT PAGE
  // -------------------------------------------------------------
  const todayStr = formatDateISO(new Date());

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.25rem',
      }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text-main)', margin: 0 }}>
            Appointment Cart & Checkout
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0' }}>
            Review tests from your selected clinic, pick appointment slot, and pay online.
          </p>
        </div>

        <button
          onClick={clearCart}
          className="btn btn-ghost btn-sm"
          style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
        >
          <Trash2 size={13} />
          Empty Cart
        </button>
      </div>

      {error && (
        <div style={{
          padding: '0.75rem 1rem',
          backgroundColor: 'var(--status-error-bg)',
          border: '1px solid var(--status-error-border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--status-error-text)',
          fontSize: '0.8125rem',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <XCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* 2-Column Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left Column: Cart Items & Appointment Timing */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Clinic Banner */}
          <div className="card" style={{ padding: '1rem 1.25rem', backgroundColor: '#FFFFFF' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-subtle)',
                  color: 'var(--text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Building2 size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    {cartCentre?.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {cartCentre?.location}
                  </div>
                </div>
              </div>

              <span className="pill-badge neutral" style={{ fontSize: '0.68rem' }}>
                1 Clinic in Cart
              </span>
            </div>
          </div>

          {/* Test Items Card */}
          <div className="card" style={{ padding: '1.25rem', backgroundColor: '#FFFFFF' }}>
            <div style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--text-muted)',
              marginBottom: '0.75rem',
              display: 'flex',
              justifyContent: 'space-between',
            }}>
              <span>Selected Tests ({cartItems.length})</span>
              <span>Price</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {cartItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main)' }}>
                      {item.name}
                    </div>
                    <span className="pill-badge neutral" style={{ fontSize: '0.65rem', marginTop: '0.15rem' }}>
                      {item.category}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-main)' }}>
                      ₹{parseFloat(item.price).toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.id)}
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '0.2rem', color: 'var(--text-muted)' }}
                      title="Remove from cart"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Total Row */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '1rem',
              paddingTop: '0.85rem',
              borderTop: '1px solid var(--border-light)',
            }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Total Tests Amount:
              </span>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                ₹{totalAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Appointment Schedule Card */}
          <div className="card" style={{ padding: '1.25rem', backgroundColor: '#FFFFFF' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 0.85rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Calendar size={15} color="var(--accent-gold)" />
              Appointment Date & Time
            </h2>

            {/* Quick Date Pills */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 500 }}>
                1. Select Visit Date
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.45rem', marginBottom: '0.45rem' }}>
                {upcomingDays.map((d) => {
                  const isSelected = selectedDate === d.iso;
                  return (
                    <button
                      key={d.iso}
                      type="button"
                      onClick={() => setSelectedDate(d.iso)}
                      style={{
                        padding: '0.45rem 0.65rem',
                        borderRadius: 'var(--radius-md)',
                        border: isSelected ? '1.5px solid var(--text-main)' : '1px solid var(--border-light)',
                        backgroundColor: isSelected ? '#FFFFFF' : 'var(--bg-subtle)',
                        cursor: 'pointer',
                        fontSize: '0.78rem',
                        fontWeight: isSelected ? 600 : 500,
                        color: isSelected ? 'var(--text-main)' : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>{d.label}</span>
                      {isSelected && <CheckCircle2 size={12} color="var(--accent-gold)" />}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Or custom date:</span>
                <input
                  type="date"
                  min={todayStr}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="form-input"
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', width: 'auto' }}
                />
              </div>
            </div>

            {/* Time Slot Selector */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 500 }}>
                2. Select Available Slot
              </div>

              {/* Morning */}
              <div style={{ marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Sun size={11} color="#D97706" />
                  Morning (AM)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.35rem' }}>
                  {MORNING_SLOTS.map((slot) => {
                    const isSelected = selectedSlot.label === slot.label;
                    return (
                      <button
                        key={slot.label}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        style={{
                          padding: '0.4rem 0.2rem',
                          borderRadius: 'var(--radius-sm)',
                          border: isSelected ? '1.5px solid var(--text-main)' : '1px solid var(--border-light)',
                          backgroundColor: isSelected ? 'var(--text-main)' : '#FFFFFF',
                          color: isSelected ? '#FFFFFF' : 'var(--text-main)',
                          fontSize: '0.75rem',
                          fontWeight: isSelected ? 600 : 400,
                          cursor: 'pointer',
                        }}
                      >
                        {slot.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Afternoon */}
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Moon size={11} color="#6366F1" />
                  Afternoon & Evening (PM)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.35rem' }}>
                  {AFTERNOON_SLOTS.map((slot) => {
                    const isSelected = selectedSlot.label === slot.label;
                    return (
                      <button
                        key={slot.label}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        style={{
                          padding: '0.4rem 0.2rem',
                          borderRadius: 'var(--radius-sm)',
                          border: isSelected ? '1.5px solid var(--text-main)' : '1px solid var(--border-light)',
                          backgroundColor: isSelected ? 'var(--text-main)' : '#FFFFFF',
                          color: isSelected ? '#FFFFFF' : 'var(--text-main)',
                          fontSize: '0.75rem',
                          fontWeight: isSelected ? 600 : 400,
                          cursor: 'pointer',
                        }}
                      >
                        {slot.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Selected Slot Confirmation Badge */}
            <div style={{
              padding: '0.55rem 0.75rem',
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.78rem',
              color: '#065F46',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              marginBottom: '0.85rem',
            }}>
              <CheckCircle2 size={14} color="#059669" />
              <span><strong>Selected Slot:</strong> {getReadableSummary()}</span>
            </div>

            {/* Notes */}
            <div>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Notes for Lab (Optional)</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. 10 hours overnight fasting completed"
                className="form-textarea"
                style={{ fontSize: '0.78rem' }}
              />
            </div>
          </div>
        </div>

        {/* Right Column: Checkout & Payment Mode */}
        <div className="card" style={{ padding: '1.25rem', backgroundColor: '#FFFFFF', position: 'sticky', top: '5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.45rem', margin: 0 }}>
              <CreditCard size={16} />
              Instant Checkout
            </h2>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Encrypted</span>
          </div>

          {/* Breakdown Box */}
          <div style={{
            padding: '0.85rem',
            backgroundColor: 'var(--bg-subtle)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)',
            marginBottom: '1rem',
            fontSize: '0.8125rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Selected Tests ({cartItems.length})</span>
              <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>₹{totalAmount.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Lab Collection Fee</span>
              <span style={{ fontWeight: 600, color: '#059669' }}>FREE</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingTop: '0.5rem',
              borderTop: '1px solid var(--border-light)',
              marginTop: '0.5rem',
            }}>
              <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Total Payable</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                ₹{totalAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Simulation Toggle */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 500 }}>
              Payment Simulation Mode
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
              <button
                type="button"
                onClick={() => setSimulationMode('FORCE_SUCCESS')}
                style={{
                  padding: '0.45rem',
                  fontSize: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: simulationMode === 'FORCE_SUCCESS' ? '1px solid var(--text-main)' : '1px solid var(--border-light)',
                  backgroundColor: simulationMode === 'FORCE_SUCCESS' ? 'var(--text-main)' : '#FFFFFF',
                  color: simulationMode === 'FORCE_SUCCESS' ? '#FFFFFF' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: simulationMode === 'FORCE_SUCCESS' ? 600 : 400,
                  transition: 'all 0.12s ease',
                }}
              >
                Instant Success
              </button>

              <button
                type="button"
                onClick={() => setSimulationMode('FORCE_FAILED')}
                style={{
                  padding: '0.45rem',
                  fontSize: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: simulationMode === 'FORCE_FAILED' ? '1px solid var(--status-error-border)' : '1px solid var(--border-light)',
                  backgroundColor: simulationMode === 'FORCE_FAILED' ? 'var(--status-error-bg)' : '#FFFFFF',
                  color: simulationMode === 'FORCE_FAILED' ? 'var(--status-error-text)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: simulationMode === 'FORCE_FAILED' ? 600 : 400,
                  transition: 'all 0.12s ease',
                }}
              >
                Simulate Decline
              </button>
            </div>
          </div>

          {/* Pay Button */}
          <button
            type="button"
            onClick={handleCheckoutAndPay}
            disabled={loading}
            className="btn btn-ink"
            style={{ width: '100%', height: '42px', fontSize: '0.875rem' }}
          >
            {loading ? (
              <>
                <RefreshCw size={14} className="pulse" />
                Processing Payment...
              </>
            ) : !isAuthenticated ? (
              <>
                Sign In & Pay ₹{totalAmount.toFixed(2)}
                <span className="arrow-gold">→</span>
              </>
            ) : (
              <>
                Pay ₹{totalAmount.toFixed(2)} & Confirm
                <span className="arrow-gold">→</span>
              </>
            )}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', marginTop: '0.75rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <Lock size={11} />
            <span>256-bit encrypted simulated processing</span>
          </div>
        </div>
      </div>
    </div>
  );
}
