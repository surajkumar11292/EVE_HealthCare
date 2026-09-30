import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('eve_auth_token'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const userData = await api.getMe();
        setUser(userData);
      } catch (err) {
        console.warn('Failed to load user with current token:', err);
        api.logout();
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [token]);

  const login = async (email, password) => {
    setError(null);
    try {
      const data = await api.login(email, password);
      setToken(data.access_token);
      const userData = await api.getMe();
      setUser(userData);
      return userData;
    } catch (err) {
      setError(err.message || 'Login failed');
      throw err;
    }
  };

  const signup = async (payload) => {
    setError(null);
    try {
      await api.signup(payload);
      return await login(payload.email, payload.password);
    } catch (err) {
      setError(err.message || 'Signup failed');
      throw err;
    }
  };

  const logout = () => {
    api.logout();
    setToken(null);
    setUser(null);
  };

  // One-click quick persona switcher for evaluators and testing
  const switchPersona = async (role) => {
    setLoading(true);
    setError(null);
    try {
      if (role === 'ADMIN') {
        await login('admin@evehealthcare.com', 'Admin@123456');
      } else {
        await login('patient@evehealthcare.com', 'Patient@123456');
      }
    } catch (err) {
      console.error('Failed to switch persona:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        login,
        signup,
        logout,
        switchPersona,
        isAdmin: user?.role === 'ADMIN',
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
