import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';
import { AuthProvider } from './context/AuthContext';
import LandingPage from './LandingPage';
import AuthPage from './pages/AuthPage';
import MapPage from './pages/MapPage';
import PassengerPage from './pages/PassengerPage';

import ExpertPage from './pages/ExpertPage';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/passenger" element={<PassengerPage />} />
            <Route path="/expert" element={<ExpertPage />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
