import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { redirectPending, clearPending } from '@/lib/authPending';

const AuthContext = createContext();

const hasStoredToken = () => {
  try {
    return !!(localStorage.getItem('base44_access_token') || localStorage.getItem('token'));
  } catch {
    return false;
  }
};

const statusOf = (err) => err?.status ?? err?.response?.status ?? null;

// Base44 answers 403 with this reason when the account exists on the platform
// but has not been added to this app.
const isNotRegisteredError = (err) => {
  const reason = err?.data?.extra_data?.reason ?? err?.response?.data?.extra_data?.reason;
  return statusOf(err) === 403 && reason === 'user_not_registered';
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNotRegistered, setIsNotRegistered] = useState(false);
  // Only one session check runs at a time; later callers share its result.
  const inFlight = useRef(null);

  const userRef = useRef(null);

  const checkAuth = useCallback(({ attempts } = {}) => {
    if (inFlight.current) return inFlight.current;
    const run = (async () => {
      // Retrying is only useful right after a sign-in or checkout redirect,
      // which always lands on /app. Everywhere else one request settles it,
      // so a signed-out visitor never waits on a spinner.
      const pending = redirectPending() && window.location.pathname.startsWith('/app');
      const tries = attempts ?? (pending ? 14 : hasStoredToken() ? 2 : 1);
      let lastStatus = null;
      try {
        for (let attempt = 1; attempt <= tries; attempt++) {
          try {
            const currentUser = await base44.auth.me();
            userRef.current = currentUser;
            setUser(currentUser);
            setIsNotRegistered(false);
            clearPending();
            return currentUser;
          } catch (err) {
            lastStatus = statusOf(err);
            // A genuine "not registered" 403 won't change on retry — stop early.
            if (isNotRegisteredError(err)) break;
            // 401 is a definite "signed out" unless a redirect is still settling.
            if (lastStatus === 401 && !pending) break;
            if (attempt < tries) await sleep(1200);
          }
        }
        // A network blip or server error is not a sign-out: keep the person
        // who is already signed in.
        const definite = lastStatus === 401 || lastStatus === 403;
        if (userRef.current && !definite) return userRef.current;
        userRef.current = null;
        setUser(null);
        setIsNotRegistered(false);
        return null;
      } finally {
        setIsLoading(false);
        inFlight.current = null;
      }
    })();
    inFlight.current = run;
    return run;
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

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