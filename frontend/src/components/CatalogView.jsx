import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import AddCentreModal from './AddCentreModal';
import {
  Search,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  ShoppingCart,
  Building2,
  Check,
  Copy,
} from 'lucide-react';

export default function CatalogView({ onGoToCart }) {
  const { isAdmin } = useAuth();
  const { cartItems, addToCart, removeFromCart, isInCart, totalAmount, cartCentre } = useCart();

  const [centres, setCentres] = useState([]);
  const [centreDetails, setCentreDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('ALL');
  const [selectedCentre, setSelectedCentre] = useState(null); // When set, shows tests for this clinic only
  const [isAddCentreOpen, setIsAddCentreOpen] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(null);

  const handleCopyPhone = (number, e) => {
    if (e) e.stopPropagation();
    if (!number) return;
    navigator.clipboard.writeText(number);
    setCopiedPhone(number);
    setTimeout(() => {
      setCopiedPhone((prev) => (prev === number ? null : prev));
    }, 2000);
  };

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

  const cities = ['ALL', 'Bangalore', 'Mumbai', 'Delhi', 'Hyderabad', 'Chennai', 'Pune'];

  const filteredCentres = centres.filter((centre) => {
    const matchesCity =
      selectedCity === 'ALL' ||
      centre.location.toLowerCase().includes(selectedCity.toLowerCase());

    const matchesSearch =
      searchQuery === '' ||
      centre.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      centre.location.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCity && matchesSearch;
  });

  // Tests for currently selected centre
  const activeCentreTests = selectedCentre ? (centreDetails[selectedCentre.id] || []) : [];
  const filteredActiveTests = activeCentreTests.filter((ct) => {
    if (!searchQuery) return true;
    const name = ct.test?.name?.toLowerCase() || '';
    const cat = ct.test?.category?.toLowerCase() || '';
    return name.includes(searchQuery.toLowerCase()) || cat.includes(searchQuery.toLowerCase());
  });

  // Handle Add to Cart or Toggle
  const handleToggleCart = (centre, centreTest) => {
    if (isInCart(centreTest.id)) {
      removeFromCart(centreTest.id);
    } else {
      addToCart(centre, centreTest);
    }
  };

  return (
    <div>
      {/* -------------------------------------------------------------
          STEP 2: CLINIC DETAILS & AVAILABLE TESTS MENU
          ------------------------------------------------------------- */}
      {selectedCentre ? (
        <div>
          {/* Back button & Header */}
          <div style={{ marginBottom: '1.25rem' }}>
            <button
              onClick={() => {
                setSelectedCentre(null);
                setSearchQuery('');
              }}
              className="btn btn-ghost btn-sm"
              style={{ padding: '0.35rem 0.65rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <ArrowLeft size={14} />
              <span>Back to All Clinics</span>
            </button>

            {/* Selected Clinic Banner */}
            <div className="card" style={{ padding: '1.25rem 1.5rem', backgroundColor: '#FFFFFF' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <span className="pill-badge success">Verified Lab</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {activeCentreTests.length} tests available
                    </span>
                  </div>
                  <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text-main)', margin: '0 0 0.35rem' }}>
                    {selectedCentre.name}
                  </h1>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <MapPin size={13} color="var(--text-muted)" />
                      <span>{selectedCentre.location}</span>
                    </div>
                    {selectedCentre.contact_number && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Phone size={13} color="var(--text-muted)" />
                        <a
                          href={`tel:${selectedCentre.contact_number}`}
                          style={{ color: 'inherit', textDecoration: 'none' }}
                          title="Click to call"
                        >
                          {selectedCentre.contact_number}
                        </a>
                        <button
                          type="button"
                          onClick={(e) => handleCopyPhone(selectedCentre.contact_number, e)}
                          title="Copy phone number"
                          style={{
                            background: copiedPhone === selectedCentre.contact_number ? '#DCFCE7' : 'rgba(0,0,0,0.04)',
                            border: '1px solid',
                            borderColor: copiedPhone === selectedCentre.contact_number ? '#86EFAC' : 'transparent',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '3px 5px',
                            marginLeft: '2px',
                            color: copiedPhone === selectedCentre.contact_number ? '#15803d' : 'var(--text-muted)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {copiedPhone === selectedCentre.contact_number ? (
                            <Check size={12} color="#15803d" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                        {copiedPhone === selectedCentre.contact_number && (
                          <span style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 600 }}>
                            Copied!
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {cartItems.length > 0 && cartCentre?.id === selectedCentre.id && (
                  <button
                    onClick={onGoToCart}
                    className="btn btn-ink"
                    style={{ padding: '0.55rem 1rem', fontSize: '0.8125rem' }}
                  >
                    <ShoppingCart size={14} />
                    <span>View Cart ({cartItems.length}) · ₹{totalAmount.toFixed(2)}</span>
                    <ArrowRight size={13} className="arrow-gold" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Search inside this clinic's tests */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.25rem',
            gap: '1rem',
          }}>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                Available Diagnostic Tests & Packages
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0' }}>
                Select one or multiple tests to add to your appointment cart
              </p>
            </div>

            <div style={{ position: 'relative', width: '280px' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tests in this clinic..."
                className="form-input"
                style={{ paddingLeft: '2rem', height: '34px', fontSize: '0.8125rem' }}
              />
              <Search size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
            </div>
          </div>

          {/* Grid of Tests in this Clinic */}
          {filteredActiveTests.length === 0 ? (
            <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
                No tests found matching "{searchQuery}" in this clinic.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
              {filteredActiveTests.map((ct) => {
                const inCart = isInCart(ct.id);

                return (
                  <div
                    key={ct.id}
                    className="card"
                    style={{
                      padding: '1.1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      border: inCart ? '1.5px solid var(--accent-gold)' : '1px solid var(--border-light)',
                      backgroundColor: inCart ? '#FFFEFA' : '#FFFFFF',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                        <span className="pill-badge neutral" style={{ fontSize: '0.65rem' }}>
                          {ct.test?.category || 'General'}
                        </span>
                        <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                          ₹{parseFloat(ct.price).toFixed(2)}
                        </span>
                      </div>

                      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 0.35rem' }}>
                        {ct.test?.name}
                      </h3>

                      {ct.test?.description && (
                        <p style={{
                          fontSize: '0.78rem',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.45,
                          margin: '0 0 0.85rem',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}>
                          {ct.test.description}
                        </p>
                      )}
                    </div>

                    <div style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Same-day lab collection
                      </span>

                      <button
                        type="button"
                        onClick={() => handleToggleCart(selectedCentre, ct)}
                        className={`btn btn-sm ${inCart ? 'btn-ghost' : 'btn-ink'}`}
                        style={{
                          fontSize: '0.78rem',
                          padding: '0.35rem 0.75rem',
                          border: inCart ? '1px solid #10B981' : undefined,
                          color: inCart ? '#047857' : undefined,
                          backgroundColor: inCart ? '#ECFDF5' : undefined,
                        }}
                      >
                        {inCart ? (
                          <>
                            <Check size={13} />
                            In Cart ✓
                          </>
                        ) : (
                          <>
                            <Plus size={13} />
                            Add to Cart
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sticky Bottom Bar for Cart Navigation */}
          {cartItems.length > 0 && (
            <div style={{
              position: 'fixed',
              bottom: '1.5rem',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 90,
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '0.75rem 1.25rem',
              backgroundColor: 'var(--text-main)',
              color: '#FFFFFF',
              borderRadius: 'var(--radius-full)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                <ShoppingCart size={16} color="var(--accent-gold)" />
                <span>
                  <strong>{cartItems.length} test{cartItems.length > 1 ? 's' : ''}</strong> selected · <strong>₹{totalAmount.toFixed(2)}</strong>
                </span>
              </div>
              <button
                onClick={onGoToCart}
                className="btn btn-sm"
                style={{
                  backgroundColor: '#FFFFFF',
                  color: 'var(--text-main)',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  padding: '0.35rem 0.85rem',
                  borderRadius: 'var(--radius-full)',
                  border: 'none',
                }}
              >
                Proceed to Checkout →
              </button>
            </div>
          )}
        </div>
      ) : (
        /* -------------------------------------------------------------
           STEP 1: CLINICS LIST ONLY (As requested by user)
           ------------------------------------------------------------- */
        <div>
          {/* Page Header */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1.75rem',
          }}>
            <div>
              <h1 style={{ fontSize: '1.65rem', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text-main)', margin: 0 }}>
                Diagnostic Labs & Clinics
              </h1>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.2rem', margin: 0 }}>
                Select an accredited diagnostic clinic to view test catalog and build your appointment cart.
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
            gap: '0.85rem',
            padding: '0.75rem 1rem',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-xs)',
            marginBottom: '1.75rem',
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
                    style={{ fontSize: '0.78rem', padding: '0.25rem 0.65rem' }}
                  >
                    {city === 'ALL' ? 'All Cities' : city}
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', width: '300px' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search clinic or location..."
                className="form-input"
                style={{ paddingLeft: '2.1rem', height: '34px', fontSize: '0.8125rem' }}
              />
              <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
            </div>
          </div>

          {/* Main Clinics Grid */}
          {loading ? (
            <div className="card" style={{ padding: '3.5rem', textAlign: 'center' }}>
              <RefreshCw size={24} className="pulse" style={{ margin: '0 auto 0.75rem', color: 'var(--text-muted)' }} />
              <div style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>Loading accredited diagnostic clinics...</div>
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
                No diagnostic clinics found
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                We couldn't find any clinics matching your search in {selectedCity === 'ALL' ? 'any city' : selectedCity}.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
              {filteredCentres.map((centre) => {
                const tests = centreDetails[centre.id] || [];
                const isCurrentCartCentre = cartCentre?.id === centre.id && cartItems.length > 0;

                return (
                  <div
                    key={centre.id}
                    className="card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      padding: '1.25rem',
                      cursor: 'pointer',
                      border: isCurrentCartCentre ? '1.5px solid var(--accent-gold)' : '1px solid var(--border-light)',
                      transition: 'all 0.15s ease',
                    }}
                    onClick={() => {
                      setSelectedCentre(centre);
                      setSearchQuery('');
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                        <span className="pill-badge success" style={{ fontSize: '0.68rem' }}>
                          Verified Lab
                        </span>
                        {isCurrentCartCentre ? (
                          <span className="pill-badge gold" style={{ fontSize: '0.68rem' }}>
                            {cartItems.length} in cart
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {tests.length} tests available
                          </span>
                        )}
                      </div>

                      <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 0.45rem' }}>
                        {centre.name}
                      </h3>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <MapPin size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                          <span>{centre.location}</span>
                        </div>
                        {centre.contact_number && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Phone size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            <a
                              href={`tel:${centre.contact_number}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ color: 'inherit', textDecoration: 'none' }}
                              title="Click to call"
                            >
                              {centre.contact_number}
                            </a>
                            <button
                              type="button"
                              onClick={(e) => handleCopyPhone(centre.contact_number, e)}
                              title="Copy phone number"
                              style={{
                                background: copiedPhone === centre.contact_number ? '#DCFCE7' : 'rgba(0,0,0,0.04)',
                                border: '1px solid',
                                borderColor: copiedPhone === centre.contact_number ? '#86EFAC' : 'transparent',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '2px 4px',
                                color: copiedPhone === centre.contact_number ? '#15803d' : 'var(--text-muted)',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {copiedPhone === centre.contact_number ? (
                                <Check size={11} color="#15803d" />
                              ) : (
                                <Copy size={11} />
                              )}
                            </button>
                            {copiedPhone === centre.contact_number && (
                              <span style={{ fontSize: '0.7rem', color: '#15803d', fontWeight: 600 }}>
                                Copied!
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{
                      paddingTop: '0.85rem',
                      borderTop: '1px solid var(--border-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        NABL Accredited
                      </span>

                      <button
                        type="button"
                        className="btn btn-ink btn-sm"
                        style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCentre(centre);
                          setSearchQuery('');
                        }}
                      >
                        <span>View Tests & Packages</span>
                        <ArrowRight size={13} className="arrow-gold" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Admin Add Centre Modal */}
      {isAddCentreOpen && (
        <AddCentreModal
          isOpen={isAddCentreOpen}
          onClose={() => setIsAddCentreOpen(false)}
          onCentreAdded={() => fetchCentres()}
        />
      )}
    </div>
  );
}
