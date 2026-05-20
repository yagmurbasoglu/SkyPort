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
const AUTH_ENDPOINTS = ['/api/auth/login', '/api/auth/register', '/api/auth/check-email'];

// On initial load, attach token if it exists
const token = localStorage.getItem(TOKEN_KEY);
if (token) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

// Add a response interceptor to handle 401 errors globally
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = String(error.config?.url || '');
    const isAuthRequest = AUTH_ENDPOINTS.some((endpoint) => requestUrl.includes(endpoint));
    const hasStoredToken = Boolean(localStorage.getItem(TOKEN_KEY));

    if (error.response?.status === 401 && hasStoredToken && !isAuthRequest) {
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
    formData.append('username', email.trim().toLowerCase());
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

  const checkEmailAvailability = async (email) => {
    const result = await axios.get('/api/auth/check-email', {
      params: { email: email.trim().toLowerCase() }
    });
    return result.data.available;
  };

  const register = async ({ email, password, role: selectedRole, name }) => {
    // 1. Register User
    await axios.post('/api/auth/register', {
      email: email.trim().toLowerCase(),
      password,
      role: selectedRole || 'passenger',
      full_name: name?.trim()
    });
    
    // 2. Automatically login after registration
    return login({ email, password });
  };

  const updateProfile = async ({ full_name, password }) => {
    const payload = {};
    if (typeof full_name === 'string') payload.full_name = full_name.trim();
    if (password) payload.password = password;
    const result = await axios.patch('/api/users/me', payload);
    const updatedUser = result.data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
    setUser(updatedUser);
    return updatedUser;
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    window.location.replace('http://localhost:3000/');
  };

  return (
    <AuthContext.Provider value={{ user, isLoggedIn, role, login, register, logout, checkEmailAvailability, updateProfile }}>
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
