import React, { createContext, useContext, useState } from 'react';

/**
 * ============================================================
 * AuthContext — Simulated Authentication
 * ============================================================
 * Currently uses localStorage to simulate login/register.
 *
 * TODO: Replace the login() and register() functions with real API calls:
 *   POST /api/auth/login    { email, password }       → returns { token, user }
 *   POST /api/auth/register { email, password, role } → returns { token, user }
 *
 * TODO: Store the JWT token in localStorage and attach it to axios requests:
 *   axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
 * ============================================================
 */

const AuthContext = createContext(null);

const STORAGE_KEY = 'skyport_user';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const isLoggedIn = !!user;
  const role = user?.role || null; // 'passenger' | 'analyst' | null

  // ── TODO: Replace with POST /api/auth/login ──────────────────────────────
  const login = ({ email, password }) => {
    // Simulated: any email/password works
    const existingUser = { email, role: user?.role || 'passenger', name: email.split('@')[0] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existingUser));
    setUser(existingUser);
    return Promise.resolve(existingUser);
  };

  // ── TODO: Replace with POST /api/auth/register ───────────────────────────
  const register = ({ email, password, role: selectedRole, name }) => {
    // Simulated: stores user in localStorage
    const newUser = { email, role: selectedRole, name: name || email.split('@')[0] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
    setUser(newUser);
    return Promise.resolve(newUser);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoggedIn, role, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for easy access
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};

export default AuthContext;
