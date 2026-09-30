import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user } = useAuth();

  // User-specific storage key to guarantee isolation between Admin, Sarah, John, Rajesh
  const userKey = user?.email ? `user_${user.email}` : 'guest';
  const prevUserKeyRef = useRef(userKey);

  // Helper to load user's specific cart from localStorage
  const loadUserCart = (key) => {
    try {
      const itemsStr = localStorage.getItem(`eve_cart_items_${key}`);
      const centreStr = localStorage.getItem(`eve_cart_centre_${key}`);
      return {
        items: itemsStr ? JSON.parse(itemsStr) : [],
        centre: centreStr ? JSON.parse(centreStr) : null,
      };
    } catch {
      return { items: [], centre: null };
    }
  };

  const initial = loadUserCart(userKey);
  const [cartItems, setCartItems] = useState(initial.items);
  const [cartCentre, setCartCentre] = useState(initial.centre);

  // Conflict modal state for switching clinics
  const [conflictData, setConflictData] = useState(null);

  // When user changes (e.g. from Admin to Sarah or John), reload that user's specific cart!
  useEffect(() => {
    if (prevUserKeyRef.current !== userKey) {
      prevUserKeyRef.current = userKey;
      const userCart = loadUserCart(userKey);
      setCartItems(userCart.items);
      setCartCentre(userCart.centre);
      setConflictData(null);
    }
  }, [userKey]);

  // Sync current user's cart changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`eve_cart_items_${userKey}`, JSON.stringify(cartItems));
      localStorage.setItem(`eve_cart_centre_${userKey}`, JSON.stringify(cartCentre));
    } catch (e) {
      console.warn('Failed to sync user cart to localStorage', e);
    }
  }, [cartItems, cartCentre, userKey]);

  const isInCart = (centreTestId) => {
    return cartItems.some((item) => item.id === centreTestId);
  };

  const addToCart = (centre, centreTest) => {
    // 1. If cart is empty, set clinic and add test
    if (!cartCentre || cartItems.length === 0) {
      setCartCentre(centre);
      setCartItems([
        {
          id: centreTest.id,
          testId: centreTest.test?.id || centreTest.test_id,
          name: centreTest.test?.name || 'Diagnostic Test',
          category: centreTest.test?.category || 'General',
          description: centreTest.test?.description || '',
          price: parseFloat(centreTest.price),
          centreId: centre.id,
          centreName: centre.name,
          centreLocation: centre.location,
        },
      ]);
      return { success: true };
    }

    // 2. If same clinic, add test if not duplicate
    if (cartCentre.id === centre.id) {
      if (isInCart(centreTest.id)) {
        return { success: true, alreadyInCart: true };
      }
      setCartItems((prev) => [
        ...prev,
        {
          id: centreTest.id,
          testId: centreTest.test?.id || centreTest.test_id,
          name: centreTest.test?.name || 'Diagnostic Test',
          category: centreTest.test?.category || 'General',
          description: centreTest.test?.description || '',
          price: parseFloat(centreTest.price),
          centreId: centre.id,
          centreName: centre.name,
          centreLocation: centre.location,
        },
      ]);
      return { success: true };
    }

    // 3. Different clinic: trigger conflict modal!
    setConflictData({
      currentCentre: cartCentre,
      newCentre: centre,
      pendingTest: centreTest,
    });
    return { success: false, conflict: true };
  };

  const confirmSwitchClinicAndAdd = () => {
    if (!conflictData) return;
    const { newCentre, pendingTest } = conflictData;
    setCartCentre(newCentre);
    setCartItems([
      {
        id: pendingTest.id,
        testId: pendingTest.test?.id || pendingTest.test_id,
        name: pendingTest.test?.name || 'Diagnostic Test',
        category: pendingTest.test?.category || 'General',
        description: pendingTest.test?.description || '',
        price: parseFloat(pendingTest.price),
        centreId: newCentre.id,
        centreName: newCentre.name,
        centreLocation: newCentre.location,
      },
    ]);
    setConflictData(null);
  };

  const cancelSwitchClinic = () => {
    setConflictData(null);
  };

  const removeFromCart = (centreTestId) => {
    setCartItems((prev) => {
      const updated = prev.filter((item) => item.id !== centreTestId);
      if (updated.length === 0) {
        setCartCentre(null);
      }
      return updated;
    });
  };

  const clearCart = () => {
    setCartItems([]);
    setCartCentre(null);
    try {
      localStorage.removeItem(`eve_cart_items_${userKey}`);
      localStorage.removeItem(`eve_cart_centre_${userKey}`);
    } catch {}
  };

  const totalAmount = cartItems.reduce((sum, item) => sum + item.price, 0);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        cartCentre,
        addToCart,
        removeFromCart,
        clearCart,
        isInCart,
        totalAmount,
        conflictData,
        confirmSwitchClinicAndAdd,
        cancelSwitchClinic,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
