import React, { useState } from 'react';
import {
  Box, Paper, Typography, Button, Divider, Autocomplete,
  TextField, CircularProgress,
} from '@mui/material';
import FlightIcon from '@mui/icons-material/Flight';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import StraightenIcon from '@mui/icons-material/Straighten';
import PaymentIcon from '@mui/icons-material/Payment';
import { MOCK_VERTIPORTS, generateMockRoute } from '../../mock/vertiports';

const autoSx = {
  '& .MuiOutlinedInput-root': {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '8px',
    fontFamily: 'Inter',
    fontSize: '0.82rem',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
    '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
  },
  '& .MuiInputLabel-root': { color: '#475569', fontFamily: 'Inter', fontSize: '0.82rem' },
  '& .MuiInputBase-input': { color: '#e2e8f0', fontFamily: 'Inter', fontSize: '0.82rem' },
  '& .MuiAutocomplete-popupIndicator': { color: '#475569' },
  '& .MuiAutocomplete-clearIndicator': { color: '#475569' },
};

const RoutePlanner = ({ onRouteCalculated, onClearRoute }) => {
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSwap = () => {
    setFrom(to);
    setTo(from);
    setRoute(null);
    onClearRoute();
  };

  /**
   * TODO: Replace this mock with a real API call:
   *   POST /api/route  { fromId: from.id, toId: to.id }
   *   Expected response: { coordinates: [lng,lat][], distance_km, duration_min, price_tl }
   */
  const handleFindRoute = () => {
    if (!from || !to) return;
    setLoading(true);
    // Simulate network delay
    setTimeout(() => {
      const result = generateMockRoute(from, to);
      setRoute(result);
      onRouteCalculated(result);
      setLoading(false);
    }, 800);
  };

  const handleClear = () => {
    setFrom(null);
    setTo(null);
    setRoute(null);
    onClearRoute();
  };

  return (
    <Paper
      sx={{
        position: 'absolute',
        top: 72,
        left: 16,
        zIndex: 10,
        width: 270,
        background: 'rgba(10, 18, 35, 0.92)',
        backdropFilter: 'blur(14px)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '14px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 1 }}>
        <FlightIcon sx={{ fontSize: 16, color: '#8b5cf6' }} />
        <Typography sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Route Planner
        </Typography>
      </Box>

      <Box sx={{ p: 2 }}>
        {/* From selector */}
        <Autocomplete
          options={MOCK_VERTIPORTS.filter((vp) => vp.id !== to?.id)}
          getOptionLabel={(vp) => vp.name}
          value={from}
          onChange={(_, val) => { setFrom(val); setRoute(null); onClearRoute(); }}
          size="small"
          renderInput={(params) => (
            <TextField {...params} label="From" placeholder="Select departure" sx={autoSx} />
          )}
          renderOption={(props, vp) => (
            <Box component="li" {...props} sx={{ fontSize: '0.8rem', color: '#e2e8f0', '&:hover': { background: 'rgba(59,130,246,0.1)' } }}>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography sx={{ fontSize: '0.8rem', color: '#e2e8f0' }}>{vp.name}</Typography>
                <Typography sx={{ fontSize: '0.65rem', color: '#475569' }}>{vp.distanceFromCenter} km from center</Typography>
              </Box>
            </Box>
          )}
          PaperComponent={({ children }) => (
            <Paper sx={{ background: '#0d1525', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, mt: 0.5 }}>
              {children}
            </Paper>
          )}
        />

        {/* Swap button */}
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 0.5 }}>
          <Button
            onClick={handleSwap}
            size="small"
            sx={{
              minWidth: 32, width: 32, height: 32, p: 0, borderRadius: '50%',
              color: '#475569', border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
              '&:hover': { color: '#e2e8f0', background: 'rgba(59,130,246,0.1)' },
            }}
          >
            <SwapVertIcon sx={{ fontSize: 16 }} />
          </Button>
        </Box>

        {/* To selector */}
        <Autocomplete
          options={MOCK_VERTIPORTS.filter((vp) => vp.id !== from?.id)}
          getOptionLabel={(vp) => vp.name}
          value={to}
          onChange={(_, val) => { setTo(val); setRoute(null); onClearRoute(); }}
          size="small"
          renderInput={(params) => (
            <TextField {...params} label="To" placeholder="Select arrival" sx={autoSx} />
          )}
          renderOption={(props, vp) => (
            <Box component="li" {...props} sx={{ fontSize: '0.8rem', color: '#e2e8f0', '&:hover': { background: 'rgba(59,130,246,0.1)' } }}>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography sx={{ fontSize: '0.8rem', color: '#e2e8f0' }}>{vp.name}</Typography>
                <Typography sx={{ fontSize: '0.65rem', color: '#475569' }}>{vp.distanceFromCenter} km from center</Typography>
              </Box>
            </Box>
          )}
          PaperComponent={({ children }) => (
            <Paper sx={{ background: '#0d1525', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, mt: 0.5 }}>
              {children}
            </Paper>
          )}
        />

        {/* Find Route button */}
        <Button
          fullWidth
          variant="contained"
          disabled={!from || !to || loading || from.id === to.id}
          onClick={handleFindRoute}
          sx={{
            mt: 2, py: 1.1, textTransform: 'none', fontWeight: 700,
            fontSize: '0.85rem', fontFamily: 'Inter',
            background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
            boxShadow: '0 4px 14px rgba(139,92,246,0.3)',
            '&:hover': { boxShadow: '0 4px 20px rgba(139,92,246,0.45)' },
            '&:disabled': { opacity: 0.4 },
          }}
          startIcon={loading ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <FlightIcon sx={{ fontSize: 16 }} />}
        >
          {loading ? 'Calculating...' : 'Find Route'}
        </Button>

        {/* Route result */}
        {route && (
          <>
            <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.06)' }} />
            <Typography sx={{ fontSize: '0.7rem', color: '#475569', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', mb: 1.5 }}>
              Route Details
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
              <StatBox icon={<StraightenIcon sx={{ fontSize: 14, color: '#60a5fa' }} />} label="Distance" value={`${route.distance_km} km`} />
              <StatBox icon={<AccessTimeIcon sx={{ fontSize: 14, color: '#34d399' }} />} label="Duration" value={`${route.duration_min} min`} />
              <StatBox icon={<PaymentIcon sx={{ fontSize: 14, color: '#f59e0b' }} />} label="Price" value={`₺${route.price_tl}`} />
            </Box>

            <Button
              fullWidth size="small"
              onClick={handleClear}
              sx={{
                mt: 1.5, textTransform: 'none', fontSize: '0.75rem',
                color: '#475569', border: '1px solid rgba(255,255,255,0.07)',
                '&:hover': { color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' },
              }}
            >
              Clear Route
            </Button>
          </>
        )}
      </Box>
    </Paper>
  );
};

const StatBox = ({ icon, label, value }) => (
  <Box sx={{
    background: 'rgba(255,255,255,0.04)', borderRadius: 1.5, p: 1,
    border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center',
  }}>
    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.5 }}>{icon}</Box>
    <Typography sx={{ fontSize: '0.6rem', color: '#475569', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</Typography>
    <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0', mt: 0.2 }}>{value}</Typography>
  </Box>
);

export default RoutePlanner;
