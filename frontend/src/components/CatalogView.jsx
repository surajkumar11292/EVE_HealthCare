import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AddCentreModal from './AddCentreModal';
import { Search, MapPin, Phone, Plus, RefreshCw, Calendar, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function CatalogView({ onBookTest }) {
  const { isAdmin } = useAuth();
  const [centres, setCentres] = useState([]);
  const [centreDetails, setCentreDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('ALL');
  const [isAddCentreOpen, setIsAddCentreOpen] = useState(false);

  const fetchCentres = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCentres({ size: 50 });
      const centreList = data.items || [];
      setCentres(centreList);

      const detailsMap = {};
      await Promise.all(
        centreList.map(async (c) => {
          try {
            const detail = await api.getCentreDetails(c.id);
            detailsMap[c.id] = detail.tests || [];
          } catch (err) {
            console.warn(`Failed to fetch tests for centre ${c.id}:`, err);
            detailsMap[c.id] = [];
          }
        })
      );
      setCentreDetails(detailsMap);
    } catch (err) {
      setError(err.message || 'Unable to load diagnostic catalog. Please check your network.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCentres();
  }, []);

  const cities = ['ALL', 'Bangalore', 'Mumbai', 'Delhi'];

  const filteredCentres = centres.filter((centre) => {
    const matchesCity =
      selectedCity === 'ALL' ||
      centre.location.toLowerCase().includes(selectedCity.toLowerCase());

    const tests = centreDetails[centre.id] || [];
    const matchesSearch =
      searchQuery === '' ||
      centre.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      centre.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tests.some(
        (t) =>
          t.test?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.test?.category?.toLowerCase().includes(searchQuery.toLowerCase())
      );

    return matchesCity && matchesSearch;
  });

  return (
    <div>
      {/* Page Header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text-main)' }}>
            Find Diagnostic Tests
          </h1>
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Browse accredited pathology labs, compare checkup packages, and book instant appointments.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={fetchCentres}
            disabled={loading}
            className="btn btn-ghost btn-sm"
          >
            <RefreshCw size={13} className={loading ? 'pulse' : ''} />
            Refresh
          </button>

          {isAdmin && (
            <button
              onClick={() => setIsAddCentreOpen(true)}
              className="btn btn-ink btn-sm"
            >
              <Plus size={14} />
              Add Diagnostic Lab
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        padding: '0.75rem 1rem',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-xs)',
        marginBottom: '2rem',
      }}>
        {/* City Filter Pills */}
        <div className="impeccable-pill-bar">
          {cities.map((city) => {
            const isSelected = selectedCity === city;
            return (
              <button
                key={city}
                onClick={() => setSelectedCity(city)}
                className={`impeccable-pill-btn ${isSelected ? 'active' : ''}`}
              >
                {isSelected && <span className="dot green"></span>}
                {city === 'ALL' ? 'All Cities' : city}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: '320px' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search test, package, or lab..."
            className="form-input"
            style={{ paddingLeft: '2.1rem', height: '36px', fontSize: '0.875rem' }}
          />
          <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
        </div>
      </div>

      {/* Main Catalog Content */}
      {loading ? (
        <div className="card" style={{ padding: '3.5rem', textAlign: 'center' }}>
          <RefreshCw size={24} className="pulse" style={{ margin: '0 auto 0.75rem', color: 'var(--text-muted)' }} />
          <div style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>Loading diagnostic centres and test offerings...</div>
        </div>
      ) : error ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', borderColor: 'var(--status-error-border)' }}>
          <AlertCircle size={24} style={{ margin: '0 auto 0.5rem', color: 'var(--status-error-text)' }} />
          <div style={{ color: 'var(--status-error-text)', fontSize: '0.9375rem' }}>{error}</div>
          <button onClick={fetchCentres} className="btn btn-ghost btn-sm" style={{ marginTop: '1rem' }}>
            Try Again
          </button>
        </div>
      ) : filteredCentres.length === 0 ? (
        <div className="card" style={{ padding: '3.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
            No diagnostic labs found
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            We couldn't find any laboratories matching your search in {selectedCity === 'ALL' ? 'any city' : selectedCity}.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '1.5rem' }}>
          {filteredCentres.map((centre) => {
            const tests = centreDetails[centre.id] || [];

            return (
              <div key={centre.id} className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Lab Header */}
                <div style={{
                  paddingBottom: '1rem',
                  borderBottom: '1px solid var(--border-light)',
                  marginBottom: '1.25rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span className="pill-badge success">
                      <span className="dot green"></span>
                      Verified Partner Lab
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {tests.length} tests available
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    {centre.name}
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <MapPin size={14} style={{ color: 'var(--text-muted)' }} />
                      <span>{centre.location}</span>
                    </div>
                    {centre.contact_number && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Phone size={14} style={{ color: 'var(--text-muted)' }} />
                        <span>{centre.contact_number}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tests List */}
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: '0.75rem',
                  }}>
                    Available Tests & Packages
                  </div>

                  {tests.length === 0 ? (
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '1rem 0', textAlign: 'center' }}>
                      No tests currently published for this location.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      {tests.map((ct) => (
                        <div
                          key={ct.id}
                          style={{
                            padding: '0.85rem 1rem',
                            border: '1px solid var(--border-light)',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--bg-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '1rem',
                            transition: 'border-color 0.15s ease',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                              <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main)' }}>
                                {ct.test?.name || 'Diagnostic Test'}
                              </span>
                              <span style={{
                                fontSize: '0.7rem',
                                padding: '0.1rem 0.45rem',
                                borderRadius: 'var(--radius-full)',
                                backgroundColor: '#E5E7EB',
                                color: '#374151',
                                fontWeight: 500,
                              }}>
                                {ct.test?.category || 'Routine'}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {ct.test?.description || 'Laboratory diagnostic evaluation with digital report.'}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>
                                ₹{parseFloat(ct.price).toFixed(2)}
                              </div>
                            </div>

                            <button
                              onClick={() => onBookTest && onBookTest(centre, ct)}
                              className="btn btn-ink btn-sm"
                              style={{ whiteSpace: 'nowrap' }}
                            >
                              Book Test
                              <span className="arrow-gold">→</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Admin Add Centre Modal */}
      <AddCentreModal
        isOpen={isAddCentreOpen}
        onClose={() => setIsAddCentreOpen(false)}
        onCentreCreated={() => {
          fetchCentres();
        }}
      />
    </div>
  );
}
