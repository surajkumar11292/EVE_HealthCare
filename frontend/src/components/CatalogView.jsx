import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AddCentreModal from './AddCentreModal';
import { Search, MapPin, Phone, Plus, RefreshCw, Stethoscope, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

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

      // Fetch detailed test catalog for each centre
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
      setError(err.message || 'Failed to load diagnostic catalog.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCentres();
  }, []);

  const cities = ['ALL', 'Bangalore', 'Mumbai', 'Delhi'];

  // Filter centres and tests
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
      {/* Catalog Header & Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        <div>
          <div className="kicker">// 01 DIAGNOSTIC CATALOG MATRIX</div>
          <h2 style={{ fontSize: '1.5rem', marginTop: '0.2rem' }}>
            Diagnostic Centres & Test Offerings
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Explore verified pathology labs and imaging centres with transparent, immutable price snapshotting.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={fetchCentres}
            disabled={loading}
            className="btn btn-ghost btn-sm"
            title="Refresh Catalog (Verifies Redis Cache)"
          >
            <RefreshCw size={12} className={loading ? 'pulse' : ''} />
            Refresh
          </button>

          {isAdmin && (
            <button
              onClick={() => setIsAddCentreOpen(true)}
              className="btn btn-ink btn-sm"
            >
              <Plus size={14} />
              Onboard Centre
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}>
          {/* City Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginRight: '0.5rem' }}>
              CITY FILTER:
            </span>
            {cities.map((city) => (
              <button
                key={city}
                onClick={() => setSelectedCity(city)}
                style={{
                  padding: '0.25rem 0.65rem',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  borderRadius: 'var(--radius-full)',
                  border: selectedCity === city ? '1px solid var(--border-strong)' : '1px solid var(--border-light)',
                  backgroundColor: selectedCity === city ? 'var(--bg-dark)' : 'transparent',
                  color: selectedCity === city ? 'var(--text-inverse)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.1s ease',
                }}
              >
                {city === 'ALL' ? 'All Cities' : city}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div style={{ position: 'relative', width: '280px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search centres or tests..."
              className="form-input"
              style={{ paddingLeft: '2rem', height: '34px', fontSize: '0.8125rem' }}
            />
            <Search size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
          </div>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <RefreshCw size={24} className="pulse" style={{ margin: '0 auto 0.75rem', color: 'var(--text-muted)' }} />
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Querying diagnostic centres and Redis cache...</div>
        </div>
      ) : error ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', borderColor: 'var(--status-error-border)' }}>
          <AlertCircle size={24} style={{ margin: '0 auto 0.5rem', color: 'var(--status-error-text)' }} />
          <div style={{ color: 'var(--status-error-text)', fontSize: '0.875rem' }}>{error}</div>
          <button onClick={fetchCentres} className="btn btn-ghost btn-sm" style={{ marginTop: '1rem' }}>
            Retry Request
          </button>
        </div>
      ) : filteredCentres.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            No diagnostic centres found matching your filter criteria.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '1.5rem' }}>
          {filteredCentres.map((centre) => {
            const tests = centreDetails[centre.id] || [];

            return (
              <div key={centre.id} className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Centre Header */}
                <div style={{
                  paddingBottom: '1rem',
                  borderBottom: '1px solid var(--border-light)',
                  marginBottom: '1rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span className="pill-badge success">
                      <span className="dot green"></span>
                      ACTIVE
                    </span>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      {tests.length} TESTS OFFERED
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.15rem', marginBottom: '0.4rem' }}>
                    {centre.name}
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <MapPin size={13} style={{ color: 'var(--text-muted)' }} />
                      <span>{centre.location}</span>
                    </div>
                    {centre.contact_number && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Phone size={13} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{centre.contact_number}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tests Offerings List */}
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '0.7rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '0.65rem',
                  }}>
                    AVAILABLE DIAGNOSTIC TESTS:
                  </div>

                  {tests.length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.75rem 0' }}>
                      No diagnostic tests linked to this centre yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {tests.map((ct) => (
                        <div
                          key={ct.id}
                          style={{
                            padding: '0.65rem 0.85rem',
                            border: '1px solid var(--border-light)',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--bg-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.15rem' }}>
                              <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                                {ct.test?.name || 'Diagnostic Test'}
                              </span>
                              <span style={{
                                fontSize: '0.65rem',
                                padding: '0.1rem 0.35rem',
                                borderRadius: '4px',
                                backgroundColor: '#E4E4E7',
                                color: '#3F3F46',
                                fontFamily: 'var(--font-mono)',
                              }}>
                                {ct.test?.category || 'General'}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {ct.test?.description || 'Routine diagnostic laboratory evaluation'}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{
                              textAlign: 'right',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 700,
                              fontSize: '0.9rem',
                            }}>
                              ₹{parseFloat(ct.price).toFixed(2)}
                            </div>

                            <button
                              onClick={() => onBookTest && onBookTest(centre, ct)}
                              className="btn btn-ink btn-sm"
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                            >
                              Book Test
                              <ArrowRight size={12} />
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

      {/* Admin Centre Onboarding Modal */}
      <AddCentreModal
        isOpen={isAddCentreOpen}
        onClose={() => setIsAddCentreOpen(false)}
        onCentreCreated={(newCentre) => {
          fetchCentres();
        }}
      />
    </div>
  );
}
