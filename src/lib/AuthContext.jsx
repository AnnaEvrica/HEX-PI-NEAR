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
      // Fast path: if there's no auth token at all, the user is logged out.
      // Skip the 8-retry me() loop entirely — otherwise a logged-out visitor
      // stares at a spinner for 5.6s before the landing page appears.
      // Only retry me() when isAuthenticated() says there IS a session but
      // me() keeps failing (the post-OAuth / Stripe checkout token
      // propagation delay case).
      let isAuth = false;
      try { isAuth = await base44.auth.isAuthenticated(); } catch { /* transient */ }

      if (isAuth) {
        // There's a session — me() should work, but may need retries during
        // token propagation (post-OAuth, post-Stripe-checkout redirect).
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
            // Only mark as "not registered" if the server explicitly says so
            // (403 / "not registered" in the error). A timeout or network error
            // during token propagation should NOT be treated as unregistered —
            // that's what was throwing logged-in users out after OAuth.
            const err = meErr?.response?.data || meErr;
            const status = err?.statusCode || err?.status || meErr?.statusCode || meErr?.status;
            const msg = (err?.message || meErr?.message || '').toLowerCase();
            const explicitlyNotRegistered =
              status === 403 ||
              msg.includes('not registered') ||
              msg.includes('user not found') ||
              msg.includes('forbidden');
            if (explicitlyNotRegistered) {
              setIsNotRegistered(true);
            }
            setUser(null);
          }
        }
      } else {
        // No session — logged out. Show the landing page immediately.
        setUser(null);
        setIsNotRegistered(false);
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
    setUser(null);
    setIsNotRegistered(false);
    try {
      await base44.auth.logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
    // Force a full page reload to '/' so the app re-mounts fresh and
    // LandingGate renders the landing page — no stale state, no retry loop.
    window.location.href = '/';
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