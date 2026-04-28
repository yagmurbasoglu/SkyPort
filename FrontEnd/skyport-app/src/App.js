import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';
import { AuthProvider } from './context/AuthContext';
import LandingPage from './LandingPage';
import AuthPage from './pages/AuthPage';
import PassengerPage from './pages/PassengerPage';
import ExpertPage from './pages/ExpertPage';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />

            {/* Protected: any logged-in user */}
            <Route
              path="/passenger"
              element={
                <ProtectedRoute requiredRole="passenger">
                  <PassengerPage />
                </ProtectedRoute>
              }
            />

            {/* Protected: expert role only */}
            <Route
              path="/expert"
              element={
                <ProtectedRoute requiredRole="expert">
                  <ExpertPage />
                </ProtectedRoute>
              }
            />

            {/* Fallback: unknown routes → home */}
            <Route path="*" element={<LandingPage />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
