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
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        try {
          const currentUser = await base44.auth.me();
          setUser(currentUser);
          setIsNotRegistered(false);
        } catch (meErr) {
          // me() can fail transiently right after OAuth redirect (token propagation delay).
          // Retry with backoff (1s, 2s, 3s) before declaring the user unregistered —
          // prevents false "Access Restricted" lockouts on slower token propagation.
          let recovered = false;
          for (let attempt = 1; attempt <= 3 && !recovered; attempt++) {
            try {
              await new Promise((r) => setTimeout(r, attempt * 1000));
              const currentUser = await base44.auth.me();
              setUser(currentUser);
              setIsNotRegistered(false);
              recovered = true;
            } catch (retryErr) {
              if (attempt === 3) {
                console.error('me() error after 3 retries:', retryErr);
                setUser(null);
                setIsNotRegistered(true);
              }
            }
          }
        }
      } else {
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