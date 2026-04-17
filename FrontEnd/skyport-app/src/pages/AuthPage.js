import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, TextField, Button, Stepper,
  Step, StepLabel, IconButton, InputAdornment, Alert,
} from '@mui/material';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import ExploreIcon from '@mui/icons-material/Explore';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useAuth } from '../context/AuthContext';

const STEPS_REGISTER = ['Account', 'Role', 'Done'];
const STEPS_LOGIN = ['Sign In', 'Done'];

const glassCard = {
  background: 'rgba(10, 18, 35, 0.92)',
  backdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '20px',
};

const AuthPage = ({ defaultMode = 'register', defaultRole = null }) => {
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const [mode, setMode] = useState(defaultMode); // 'login' | 'register'
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [selectedRole, setSelectedRole] = useState(defaultRole); // 'passenger' | 'analyst'
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const steps = mode === 'register' ? STEPS_REGISTER : STEPS_LOGIN;

  const redirectByRole = (role) => {
    if (role === 'passenger') navigate('/passenger');
    else if (role === 'expert') navigate('/expert');
    else navigate('/');
  };

  const handleAccountNext = () => {
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setError('');
    setStep(1);
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      const user = await login({ email, password });
      setStep(1);
      setTimeout(() => redirectByRole(user.role), 1200);
    } catch (e) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!selectedRole) { setError('Please select a role.'); return; }
    setLoading(true);
    try {
      const user = await register({ email, password, name, role: selectedRole });
      setStep(2);
      setTimeout(() => redirectByRole(user.role), 1500);
    } catch (e) {
      setError('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at 20% 50%, rgba(37,99,235,0.12) 0%, transparent 60%), #0a0f1a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      {/* Logo */}
      <Box
        onClick={() => navigate('/')}
        sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 4, cursor: 'pointer' }}
      >
        <Box sx={{
          width: 40, height: 40,
          background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
          borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 20px rgba(59,130,246,0.4)',
        }}>
          <FlightTakeoffIcon sx={{ color: '#fff', fontSize: 22 }} />
        </Box>
        <Typography sx={{ fontWeight: 800, fontSize: '1.4rem', letterSpacing: '-0.5px', color: '#e2e8f0' }}>
          SKY<span style={{ color: '#3b82f6' }}>PORT</span>
        </Typography>
      </Box>

      <Paper sx={{ ...glassCard, width: '100%', maxWidth: 480, p: 4 }}>

        {/* Stepper */}
        <Stepper activeStep={step} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel sx={{
                '& .MuiStepLabel-label': { color: '#475569', fontSize: '0.75rem', fontFamily: 'Inter' },
                '& .MuiStepLabel-label.Mui-active': { color: '#60a5fa' },
                '& .MuiStepLabel-label.Mui-completed': { color: '#22c55e' },
                '& .MuiStepIcon-root': { color: '#1e2d4a' },
                '& .MuiStepIcon-root.Mui-active': { color: '#3b82f6' },
                '& .MuiStepIcon-root.Mui-completed': { color: '#22c55e' },
              }}>
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* ── Login Step 0 ── */}
        {mode === 'login' && step === 0 && (
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '1.4rem', color: '#e2e8f0', mb: 0.5 }}>
              Welcome back
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mb: 3 }}>
              Sign in to your SkyPort account
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2, fontSize: '0.78rem' }}>{error}</Alert>}
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
                    <IconButton onClick={() => setShowPassword(p => !p)} edge="end" size="small" sx={{ color: '#475569' }}>
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
            <Typography variant="body2" sx={{ color: '#475569', textAlign: 'center', mt: 2 }}>
              Don't have an account?{' '}
              <span
                style={{ color: '#60a5fa', cursor: 'pointer' }}
                onClick={() => { setMode('register'); setStep(0); setError(''); }}
              >
                Register
              </span>
            </Typography>
          </Box>
        )}

        {/* ── Register Step 0: Account ── */}
        {mode === 'register' && step === 0 && (
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '1.4rem', color: '#e2e8f0', mb: 0.5 }}>
              Create account
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mb: 3 }}>
              Join the SkyPort network
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2, fontSize: '0.78rem' }}>{error}</Alert>}
            <TextField
              label="Full Name" fullWidth value={name}
              onChange={(e) => setName(e.target.value)}
              sx={inputSx} size="small"
            />
            <TextField
              label="Email" type="email" fullWidth value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{ ...inputSx, mt: 2 }} size="small"
            />
            <TextField
              label="Password" type={showPassword ? 'text' : 'password'} fullWidth value={password}
              onChange={(e) => setPassword(e.target.value)}
              sx={{ ...inputSx, mt: 2 }} size="small"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(p => !p)} edge="end" size="small" sx={{ color: '#475569' }}>
                      {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button fullWidth variant="contained" sx={primaryBtnSx} onClick={handleAccountNext}>
              Continue
            </Button>
            <Typography variant="body2" sx={{ color: '#475569', textAlign: 'center', mt: 2 }}>
              Already have an account?{' '}
              <span
                style={{ color: '#60a5fa', cursor: 'pointer' }}
                onClick={() => { setMode('login'); setStep(0); setError(''); }}
              >
                Sign in
              </span>
            </Typography>
          </Box>
        )}

        {/* ── Register Step 1: Role selection ── */}
        {mode === 'register' && step === 1 && (
          <Box>
            <IconButton onClick={() => setStep(0)} sx={{ mb: 1, color: '#475569', ml: -1 }}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <Typography sx={{ fontWeight: 700, fontSize: '1.3rem', color: '#e2e8f0', mb: 0.5 }}>
              How will you use SkyPort?
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mb: 3 }}>
              Choose your role — you can change this later
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2, fontSize: '0.78rem' }}>{error}</Alert>}

            <Box sx={{ display: 'flex', gap: 2 }}>
              <RoleCard
                icon={<AnalyticsIcon sx={{ fontSize: 28, color: '#3b82f6' }} />}
                title="Analyst"
                desc="Urban planners & aviation investors performing site analysis"
                selected={selectedRole === 'expert'}
                onClick={() => setSelectedRole('expert')}
              />
              <RoleCard
                icon={<ExploreIcon sx={{ fontSize: 28, color: '#8b5cf6' }} />}
                title="Passenger"
                desc="Plan air taxi trips and explore Istanbul's UAM network"
                selected={selectedRole === 'passenger'}
                onClick={() => setSelectedRole('passenger')}
                accentColor="#8b5cf6"
              />
            </Box>

            <Button fullWidth variant="contained" sx={primaryBtnSx} onClick={handleRegister} disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </Box>
        )}

        {/* ── Success Step ── */}
        {(step === 2 || (mode === 'login' && step === 1)) && (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CheckCircleIcon sx={{ fontSize: 56, color: '#22c55e', mb: 2 }} />
            <Typography sx={{ fontWeight: 700, fontSize: '1.3rem', color: '#e2e8f0', mb: 1 }}>
              {mode === 'login' ? 'Welcome back!' : 'Account created!'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Redirecting you to your dashboard...
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

// ─── Role Card ────────────────────────────────────────────────────────────────
const RoleCard = ({ icon, title, desc, selected, onClick, accentColor = '#3b82f6' }) => (
  <Box
    onClick={onClick}
    sx={{
      flex: 1, p: 2, borderRadius: 2, cursor: 'pointer', textAlign: 'center',
      border: selected ? `1.5px solid ${accentColor}` : '1.5px solid rgba(255,255,255,0.07)',
      background: selected ? `rgba(${accentColor === '#3b82f6' ? '59,130,246' : '139,92,246'},0.1)` : 'rgba(255,255,255,0.03)',
      transition: 'all 0.2s',
      '&:hover': { background: `rgba(${accentColor === '#3b82f6' ? '59,130,246' : '139,92,246'},0.07)` },
    }}
  >
    <Box sx={{ mb: 1 }}>{icon}</Box>
    <Typography sx={{ fontWeight: 700, color: '#e2e8f0', fontSize: '0.9rem', mb: 0.5 }}>{title}</Typography>
    <Typography sx={{ fontSize: '0.7rem', color: '#64748b', lineHeight: 1.4 }}>{desc}</Typography>
  </Box>
);

// ─── Shared styles ─────────────────────────────────────────────────────────────
const inputSx = {
  '& .MuiOutlinedInput-root': {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '8px',
    fontFamily: 'Inter',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
    '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
  },
  '& .MuiInputLabel-root': { color: '#475569', fontFamily: 'Inter', fontSize: '0.85rem' },
  '& .MuiInputBase-input': { color: '#e2e8f0', fontFamily: 'Inter' },
};

const primaryBtnSx = {
  mt: 3, py: 1.2, fontWeight: 700, textTransform: 'none',
  fontSize: '0.9rem', fontFamily: 'Inter',
  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
  boxShadow: '0 4px 16px rgba(59,130,246,0.35)',
  borderRadius: '8px',
  '&:hover': { boxShadow: '0 4px 22px rgba(59,130,246,0.5)' },
};

export default AuthPage;
