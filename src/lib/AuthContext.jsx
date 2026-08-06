import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNotRegistered, setIsNotRegistered] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Call me() directly — it's the authoritative session test.
      // isAuthenticated() can return false on mobile during token propagation
      // even when the user IS authenticated, causing a false logout bounce.
      // me() tests the actual session; if it succeeds, the user is logged in.
      // Poll quickly at a fixed interval instead of long back-offs — the token
      // lands server-side at an unknown moment; fast polling detects it within
      // ~800ms instead of waiting out a multi-second backoff step.
      let recovered = false;
      for (let attempt = 1; attempt <= 8 && !recovered; attempt++) {
        try {
          if (attempt > 1) await new Promise((r) => setTimeout(r, 800));
          const currentUser = await base44.auth.me();
          setUser(currentUser);
          setIsNotRegistered(false);
          recovered = true;
        } catch (meErr) {
          if (attempt < 8) continue;
          // All me() retries failed — check if it's a genuine logout vs transient
          let isAuth = false;
          try { isAuth = await base44.auth.isAuthenticated(); } catch { /* transient */ }
          if (isAuth) {
            // Authenticated but me() keeps failing → genuinely unregistered
            setUser(null);
            setIsNotRegistered(true);
          } else {
            setUser(null);
            setIsNotRegistered(false);
          }
        }
      }
    } catch (err) {
      console.error('Auth check error:', err);
      setUser(null);
      setIsNotRegistered(false);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await base44.auth.logout('/');
    } catch (err) {
      console.error('Logout error:', err);
      setUser(null);
      window.location.href = '/';
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isNotRegistered, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};