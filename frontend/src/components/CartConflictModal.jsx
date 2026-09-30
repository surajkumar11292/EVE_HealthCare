import React from 'react';
import { useCart } from '../context/CartContext';
import { AlertTriangle, X, Trash2, ArrowRight } from 'lucide-react';

export default function CartConflictModal() {
  const { conflictData, confirmSwitchClinicAndAdd, cancelSwitchClinic } = useCart();

  if (!conflictData) return null;

  const { currentCentre, newCentre, pendingTest } = conflictData;

  return (
    <div className="modal-backdrop" onClick={cancelSwitchClinic}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '440px' }}
      >
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: '#FEF3C7',
              color: '#D97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <AlertTriangle size={15} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
              Replace Cart Items?
            </h3>
          </div>
          <button
            onClick={cancelSwitchClinic}
            className="btn btn-ghost btn-sm"
            style={{ padding: '0.25rem', border: 'none' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 1rem' }}>
            Your cart already contains diagnostic tests from <strong>{currentCentre?.name}</strong>.
            Appointments can only be scheduled with <strong>one diagnostic clinic at a time</strong>.
          </p>

          <div style={{
            padding: '0.85rem',
            backgroundColor: 'var(--bg-subtle)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)',
            marginBottom: '1.25rem',
            fontSize: '0.8125rem',
          }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>
              Switching Clinic To:
            </div>
            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
              {newCentre?.name}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.15rem' }}>
              Adding: {pendingTest?.test?.name} (₹{parseFloat(pendingTest?.price).toFixed(2)})
            </div>
          </div>

          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            If you proceed, your existing cart items from {currentCentre?.name} will be cleared.
          </p>

          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <button
              type="button"
              onClick={cancelSwitchClinic}
              className="btn btn-ghost"
              style={{ flex: 1 }}
            >
              Keep Current Cart
            </button>
            <button
              type="button"
              onClick={confirmSwitchClinicAndAdd}
              className="btn btn-ink"
              style={{ flex: 1.2, backgroundColor: '#B91C1C', color: '#FFFFFF', borderColor: '#B91C1C' }}
            >
              <Trash2 size={13} />
              Clear & Add Test
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
