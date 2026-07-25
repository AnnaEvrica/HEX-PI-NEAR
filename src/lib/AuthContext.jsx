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
    // Distinguish a definitive "logged out" from a transient error.
    // isAuthenticated() returning false = genuinely no valid session → safe to
    // send the user to the landing page. A thrown error = transient (network or
    // token-propagation delay) → keep retrying and NEVER bounce the user out.
    // Honors: don't throw the user out unless they're actually logged out.
    try {
      let isAuth = false;
      let definitive = false; // did isAuthenticated() return (not throw)?
      for (let attempt = 1; attempt <= 6 && !definitive; attempt++) {
        try {
          isAuth = await base44.auth.isAuthenticated();
          definitive = true;
        } catch { /* transient — keep retrying with backoff */ }
        if (!definitive && attempt < 6) await new Promise((r) => setTimeout(r, attempt * 800));
      }

      // Only transient errors, never a confirmed logged-out. Keep the session
      // intact (spinner stays) and retry shortly — don't bounce to "/".
      if (!definitive) {
        setTimeout(checkAuth, 5000);
        return;
      }

      if (isAuth) {
        let currentUser = null;
        let recovered = false;
        for (let attempt = 1; attempt <= 4 && !recovered; attempt++) {
          try {
            if (attempt > 1) await new Promise((r) => setTimeout(r, attempt * 1000));
            currentUser = await base44.auth.me();
            recovered = true;
          } catch { /* me() can fail transiently right after OAuth redirect — retry */ }
        }
        if (recovered && currentUser) {
          setUser(currentUser);
          setIsNotRegistered(false);
          setIsLoading(false);
        } else {
          // Token valid but profile unreadable after retries — show the
          // not-registered screen (offers a path forward) rather than bouncing.
          setIsNotRegistered(true);
          setIsLoading(false);
        }
      } else {
        // Definitive false = genuinely logged out.
        setUser(null);
        setIsNotRegistered(false);
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Auth check error:', err);
      // Unexpected error — don't throw the user out; retry in the background.
      setTimeout(checkAuth, 5000);
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