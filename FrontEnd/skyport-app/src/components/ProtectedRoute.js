import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute — Wraps routes that require authentication and/or a specific role.
 *
 * Usage:
 *   <ProtectedRoute requiredRole="expert">
 *     <ExpertPage />
 *   </ProtectedRoute>
 *
 *   <ProtectedRoute>   ← any authenticated user
 *     <PassengerPage />
 *   </ProtectedRoute>
 */
const ProtectedRoute = ({ children, requiredRole }) => {
  const { isLoggedIn, role } = useAuth();
  const location = useLocation();

  // 1. Not logged in → send to /auth, remember where they were going
  if (!isLoggedIn) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // 2. Logged in but wrong role → send to correct dashboard
  if (requiredRole && role !== requiredRole) {
    const redirect = role === 'expert' ? '/expert' : '/passenger';
    return <Navigate to={redirect} replace />;
  }

  return children;
};

export default ProtectedRoute;
