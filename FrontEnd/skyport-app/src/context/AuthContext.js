import React, { createContext, useContext, useState } from 'react';

/**
 * ============================================================
 * AuthContext — Real Authentication
 * ============================================================
 */
import axios from 'axios';

// Set base URL for backend API
axios.defaults.baseURL = 'http://localhost:8000';

const AuthContext = createContext(null);

const STORAGE_KEY = 'skyport_user';
const TOKEN_KEY = 'skyport_token';

// On initial load, attach token if it exists
const token = localStorage.getItem(TOKEN_KEY);
if (token) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

// Add a response interceptor to handle 401 errors globally
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TOKEN_KEY);
      delete axios.defaults.headers.common['Authorization'];
      window.location.href = '/auth?expired=true';
    }
    return Promise.reject(error);
  }
);

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
  const role = user?.role || null; // 'passenger' | 'expert' | null

  const login = async ({ email, password }) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    
    // 1. Get Token
    const result = await axios.post('/api/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const accessToken = result.data.access_token;
    localStorage.setItem(TOKEN_KEY, accessToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

    // 2. Get User Profile
    const meResult = await axios.get('/api/users/me');
    const existingUser = meResult.data;
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existingUser));
    setUser(existingUser);
    return existingUser;
  };

  const register = async ({ email, password, role: selectedRole, name }) => {
    // 1. Register User
    await axios.post('/api/auth/register', {
      email,
      password,
      role: selectedRole || 'passenger',
      full_name: name || email.split('@')[0]
    });
    
    // 2. Automatically login after registration
    return login({ email, password });
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
    delete axios.defaults.headers.common['Authorization'];
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
