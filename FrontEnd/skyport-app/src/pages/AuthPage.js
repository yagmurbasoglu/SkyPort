import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Paper, Typography, TextField, Button, IconButton, InputAdornment, Alert,
} from '@mui/material';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import ExploreIcon from '@mui/icons-material/Explore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useAuth } from '../context/AuthContext';

const authContainerSx = {
  width: '100%',
  maxWidth: 420,
  borderRadius: '32px',
  overflow: 'hidden',
  boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
  display: 'flex',
  flexDirection: 'column',
  background: 'transparent',
};

const headerPartSx = {
  background: 'rgba(15, 23, 42, 0.4)',
  backdropFilter: 'blur(32px)',
  border: '1px solid rgba(182, 95, 112, 0.2)',
  p: 4,
  textAlign: 'center',
  color: '#ffffff',
};

const formPartSx = {
  background: 'rgba(255, 255, 255, 0.98)',
  p: 4,
  flex: 1,
};

const validatePassword = (value) => {
  if (value.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[a-z]/.test(value)) return 'Password must include at least one lowercase letter.';
  if (!/[A-Z]/.test(value)) return 'Password must include at least one uppercase letter.';
  if (!/[0-9]/.test(value)) return 'Password must include at least one digit.';
  return '';
};

const validateEmail = (value) => {
  if (!value.trim()) return 'Email is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email address.';
  return '';
};

const validateFullName = (value) => {
  if (value.trim().length < 2) return 'Full name must be at least 2 characters long.';
  return '';
};

const getApiErrorMessage = (error, fallbackMessage) => {
  const payload = error?.response?.data;
  if (typeof payload?.message === 'string' && payload.message) {
    return payload.message;
  }
  if (Array.isArray(payload?.detail) && payload.detail.length > 0) {
    const firstError = payload.detail[0];
    if (typeof firstError?.msg === 'string' && firstError.msg) {
      return firstError.msg;
    }
  }
  return fallbackMessage;
};

const AuthPage = ({ defaultMode = 'register', defaultRole = null }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, checkEmailAvailability } = useAuth();

  const initialMode = location.state?.mode || defaultMode;
  const [mode, setMode] = useState(initialMode); // 'login' | 'register'
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [selectedRole, setSelectedRole] = useState(defaultRole); // 'passenger' | 'analyst'
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const redirectByRole = (role) => {
    if (role === 'passenger') navigate('/passenger');
    else if (role === 'expert') navigate('/expert');
    else navigate('/');
  };

  const handleAccountNext = async () => {
    const nameError = validateFullName(name);
    if (nameError) { setError(nameError); return; }
    const emailError = validateEmail(email);
    if (emailError) { setError(emailError); return; }
    if (!password) { setError('Please fill in all fields.'); return; }
    const passwordError = validatePassword(password);
    if (passwordError) { setError(passwordError); return; }
    setLoading(true);
    try {
      const isAvailable = await checkEmailAvailability(email);
      if (!isAvailable) {
        setError('The user with this email already exists in the system.');
        return;
      }
      setError('');
      setStep(1);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not verify email availability. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      const user = await login({ email, password });
      setStep(1);
      setTimeout(() => redirectByRole(user.role), 1200);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Login failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!selectedRole) { setError('Please select a role.'); return; }
    const nameError = validateFullName(name);
    if (nameError) { setError(nameError); return; }
    const emailError = validateEmail(email);
    if (emailError) { setError(emailError); return; }
    const passwordError = validatePassword(password);
    if (passwordError) { setError(passwordError); return; }
    setLoading(true);
    try {
      const user = await register({ email, password, name, role: selectedRole });
      setStep(2);
      setTimeout(() => redirectByRole(user.role), 1500);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Registration failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundImage: 'url(/istanbul_evtol.jpeg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.75) 0%, rgba(182, 95, 112, 0.35) 100%)',
          zIndex: 0,
        }
      }}
    >
      <Box sx={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Logo */}
        <Box
          onClick={() => navigate('/')}
          sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 4, cursor: 'pointer' }}
        >
          <Box sx={{
            width: 36, height: 36,
            background: 'linear-gradient(135deg, #b65f70, #1a1a2e)',
            borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(182,95,112,0.4)',
          }}>
            <FlightTakeoffIcon sx={{ color: '#fff', fontSize: 20 }} />
          </Box>
          <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', letterSpacing: '1px', color: '#ffffff', textTransform: 'uppercase' }}>
            SKY<span style={{ color: '#b65f70' }}>PORT</span>
          </Typography>
        </Box>

        <Paper sx={authContainerSx}>
          {/* Header Part */}
          <Box sx={headerPartSx}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.2em', mb: 1, textTransform: 'uppercase', opacity: 0.8 }}>
              Welcome to the
            </Typography>
            <Typography sx={{ fontSize: '2.4rem', fontWeight: 300, letterSpacing: '0.15em', mb: 2, textTransform: 'uppercase', fontFamily: '"Outfit", sans-serif' }}>
              SKYPORT
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', lineHeight: 1.6, opacity: 0.7, maxWidth: 280, mx: 'auto' }}>
              Experience the future of urban mobility in the heart of Istanbul.
            </Typography>
            
            <Button 
              size="small" 
              sx={{ 
                mt: 3, color: '#ffffff', border: '1px solid rgba(255,255,255,0.4)', 
                borderRadius: '20px', px: 3, textTransform: 'none', fontSize: '0.75rem',
                '&:hover': { background: 'rgba(255,255,255,0.1)', borderColor: '#ffffff' }
              }}
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setStep(0); setError(''); }}
            >
              {mode === 'login' ? 'Create Account' : 'Back to Login'}
            </Button>
          </Box>

          {/* Form Part */}
          <Box sx={formPartSx}>
            <Typography sx={{ textAlign: 'center', fontWeight: 500, fontSize: '1.1rem', color: '#1a1a2e', letterSpacing: '0.1em', mb: 0.5, textTransform: 'uppercase' }}>
              {mode === 'login' ? 'User Login' : (step === 0 ? 'Register' : 'Role Selection')}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: '#b65f70', mb: 3, fontWeight: 500 }}>
              {mode === 'login' ? 'Welcome back' : 'Join the network'}
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 2, fontSize: '0.72rem', borderRadius: '12px' }}>{error}</Alert>}

            {/* ── Login Step 0 ── */}
            {mode === 'login' && step === 0 && (
              <Box>
                <TextField
                  label="Email" type="email" fullWidth value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  sx={inputSx} size="small" variant="outlined"
                />
                <TextField
                  label="Password" type={showPassword ? 'text' : 'password'} fullWidth value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  sx={{ ...inputSx, mt: 2 }} size="small"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(p => !p)} edge="end" size="small" sx={{ color: '#64748b' }}>
                          {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <Button
                  fullWidth variant="contained" sx={primaryBtnSx} onClick={handleLogin} disabled={loading}
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
              </Box>
            )}

            {/* ── Register Step 0: Account ── */}
            {mode === 'register' && step === 0 && (
              <Box>
                <TextField
                  label="Full Name" fullWidth value={name}
                  onChange={(e) => setName(e.target.value)}
                  sx={inputSx} size="small"
                />
                <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#64748b', lineHeight: 1.5 }}>
                  Enter at least 2 characters. Example: Ada Yilmaz
                </Typography>
                <TextField
                  label="Email" type="email" fullWidth value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  sx={{ ...inputSx, mt: 2 }} size="small"
                />
                <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#64748b', lineHeight: 1.5 }}>
                  Use a valid format like name@example.com
                </Typography>
                <TextField
                  label="Password" type={showPassword ? 'text' : 'password'} fullWidth value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  sx={{ ...inputSx, mt: 2 }} size="small"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(p => !p)} edge="end" size="small" sx={{ color: '#64748b' }}>
                          {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#64748b', lineHeight: 1.5 }}>
                  Use at least 8 characters with uppercase, lowercase, and a number.
                </Typography>
                <Button fullWidth variant="contained" sx={primaryBtnSx} onClick={handleAccountNext} disabled={loading}>
                  {loading ? 'Checking...' : 'Continue'}
                </Button>
              </Box>
            )}

            {/* ── Register Step 1: Role selection ── */}
            {mode === 'register' && step === 1 && (
              <Box>
                <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                  <RoleCard
                    icon={<AnalyticsIcon sx={{ fontSize: 28, color: '#b65f70' }} />}
                    title="Analyst"
                    desc="Urban planners performing site analysis"
                    selected={selectedRole === 'expert'}
                    onClick={() => setSelectedRole('expert')}
                    accentColor="#b65f70"
                  />
                  <RoleCard
                    icon={<ExploreIcon sx={{ fontSize: 28, color: '#1a1a2e' }} />}
                    title="Passenger"
                    desc="Plan trips and explore UAM network"
                    selected={selectedRole === 'passenger'}
                    onClick={() => setSelectedRole('passenger')}
                    accentColor="#1a1a2e"
                  />
                </Box>
                <Button fullWidth variant="contained" sx={primaryBtnSx} onClick={handleRegister} disabled={loading}>
                  {loading ? 'Creating account...' : 'Create Account'}
                </Button>
                <Button fullWidth size="small" sx={{ mt: 1, color: '#b65f70', textTransform: 'none' }} onClick={() => setStep(0)}>
                  Back to info
                </Button>
              </Box>
            )}

            {/* ── Success Step ── */}
            {(step === 2 || (mode === 'login' && step === 1)) && (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <CheckCircleIcon sx={{ fontSize: 56, color: '#b65f70', mb: 2 }} />
                <Typography sx={{ fontWeight: 700, fontSize: '1.3rem', color: '#1a1a2e', mb: 1 }}>
                  {mode === 'login' ? 'Welcome back!' : 'Account created!'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#b65f70' }}>
                  Redirecting you to your dashboard...
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

const RoleCard = ({ icon, title, desc, selected, onClick, accentColor = '#b65f70' }) => (
  <Box
    onClick={onClick}
    sx={{
      flex: 1, p: 2, borderRadius: 2, cursor: 'pointer', textAlign: 'center',
      border: selected ? `1.5px solid ${accentColor}` : '1.5px solid rgba(0,0,0,0.05)',
      background: selected ? `${accentColor}11` : 'rgba(0,0,0,0.02)',
      transition: 'all 0.2s',
      '&:hover': { background: 'rgba(0,0,0,0.04)' },
    }}
  >
    <Box sx={{ mb: 1 }}>{icon}</Box>
    <Typography sx={{ fontWeight: 700, color: '#1a1a2e', fontSize: '0.85rem', mb: 0.5 }}>{title}</Typography>
    <Typography sx={{ fontSize: '0.65rem', color: '#b65f70', lineHeight: 1.4 }}>{desc}</Typography>
  </Box>
);

const inputSx = {
  '& .MuiOutlinedInput-root': {
    background: '#b65f7008',
    borderRadius: '12px',
    fontFamily: 'Inter',
    '& fieldset': { borderColor: 'rgba(26, 26, 46, 0.1)' },
    '&:hover fieldset': { borderColor: 'rgba(182, 95, 112, 0.2)' },
    '&.Mui-focused fieldset': { borderColor: '#b65f70' },
  },
  '& .MuiInputLabel-root': { color: '#64748b', fontFamily: 'Inter', fontSize: '0.82rem' },
  '& .MuiInputBase-input': { color: '#1a1a2e', fontFamily: 'Inter' },
};

const primaryBtnSx = {
  mt: 3, py: 1.4, fontWeight: 700, textTransform: 'uppercase',
  fontSize: '0.85rem', fontFamily: 'Inter', letterSpacing: '0.1em',
  background: '#1a1a2e',
  borderRadius: '12px',
  '&:hover': { background: '#2d2d50', boxShadow: '0 8px 24px rgba(26,26,46,0.3)' },
};

export default AuthPage;
