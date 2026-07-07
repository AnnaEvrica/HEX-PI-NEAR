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
          // Authenticated in the platform but not registered in this app's User table.
          console.error('me() error (likely not registered):', meErr);
          setUser(null);
          setIsNotRegistered(true);
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