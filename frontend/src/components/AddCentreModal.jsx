import React, { useState } from 'react';
import { api } from '../services/api';
import { X, Building2, MapPin, Phone, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function AddCentreModal({ isOpen, onClose, onCentreCreated }) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const newCentre = await api.createCentre({
        name,
        location,
        contact_number: contactNumber || null,
      });
      setName('');
      setLocation('');
      setContactNumber('');
      onCentreCreated(newCentre);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create diagnostic centre.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div className="kicker">// ADMIN CATALOG MANAGEMENT</div>
            <h3 style={{ fontSize: '1.15rem', marginTop: '0.15rem' }}>
              Onboard Diagnostic Centre
            </h3>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: '0.25rem' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {error && (
            <div style={{
              padding: '0.75rem 1rem',
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

          <div className="form-group">
            <label className="form-label">Centre Name</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Manipal Diagnostic Hub"
                className="form-input"
                style={{ paddingLeft: '2rem' }}
              />
              <Building2 size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Location (City & Address)</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Whitefield, Bangalore"
                className="form-input"
                style={{ paddingLeft: '2rem' }}
              />
              <MapPin size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Contact Phone (Optional)</label>
            <div style={{ position: 'relative' }}>
              <input
                type="tel"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="e.g. +918012345678"
                className="form-input"
                style={{ paddingLeft: '2rem' }}
              />
              <Phone size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
            </div>
          </div>

          <div style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            backgroundColor: 'var(--bg-subtle)',
            padding: '0.65rem 0.85rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)',
            marginBottom: '1.25rem',
          }}>
            ⚡ NOTICE: Creating a centre automatically triggers a Redis cache purge on the backend.
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-ink"
            style={{ width: '100%' }}
          >
            {loading ? 'Creating Centre...' : 'Register Diagnostic Centre'}
            <ArrowRight size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}
