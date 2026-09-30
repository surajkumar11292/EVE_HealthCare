import React, { useState } from 'react';
import { api } from '../services/api';
import { X, Building2, MapPin, Phone, ArrowRight } from 'lucide-react';

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
      setError(err.message || 'Unable to register diagnostic lab. Please try again.');
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
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-main)' }}>
              Add Diagnostic Lab
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
              Publish a new medical partner to the test catalog
            </p>
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
            <label className="form-label">Laboratory Name</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Manipal Pathology & Diagnostics"
                className="form-input"
                style={{ paddingLeft: '2.1rem' }}
              />
              <Building2 size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Location (City & Area)</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Indiranagar, Bangalore"
                className="form-input"
                style={{ paddingLeft: '2.1rem' }}
              />
              <MapPin size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Contact Phone (Optional)</label>
            <div style={{ position: 'relative' }}>
              <input
                type="tel"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="+918012345678"
                className="form-input"
                style={{ paddingLeft: '2.1rem' }}
              />
              <Phone size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-ink"
            style={{ width: '100%', padding: '0.7rem' }}
          >
            {loading ? 'Adding Lab...' : 'Save Diagnostic Lab'}
            <ArrowRight size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}
