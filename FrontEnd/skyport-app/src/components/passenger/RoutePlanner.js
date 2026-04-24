import React, { useState } from 'react';
import {
  Box, Paper, Typography, Button, Divider, Autocomplete,
  TextField, CircularProgress, Alert, Chip,
} from '@mui/material';
import FlightIcon from '@mui/icons-material/Flight';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import StraightenIcon from '@mui/icons-material/Straighten';
import PaymentIcon from '@mui/icons-material/Payment';
import AirIcon from '@mui/icons-material/Air';
import axios from 'axios';

const autoSx = {
  '& .MuiOutlinedInput-root': {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '8px',
    fontFamily: 'Inter',
    fontSize: '0.82rem',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
    '&.Mui-focused fieldset': { borderColor: '#b65f70' },
  },
  '& .MuiInputLabel-root': { color: '#475569', fontFamily: 'Inter', fontSize: '0.82rem' },
  '& .MuiInputBase-input': { color: '#e2e8f0', fontFamily: 'Inter', fontSize: '0.82rem' },
  '& .MuiAutocomplete-popupIndicator': { color: '#475569' },
  '& .MuiAutocomplete-clearIndicator': { color: '#475569' },
};

const scrollSx = {
  scrollbarWidth: 'thin',
  scrollbarColor: 'rgba(148,163,184,0.58) rgba(15,23,42,0.34)',
  '&::-webkit-scrollbar': {
    width: 10,
  },
  '&::-webkit-scrollbar-track': {
    background: 'rgba(15,23,42,0.34)',
    borderRadius: '8px',
  },
  '&::-webkit-scrollbar-thumb': {
    background: 'rgba(148,163,184,0.58)',
    borderRadius: '8px',
    border: '2px solid rgba(15,23,42,0.34)',
  },
  '&::-webkit-scrollbar-thumb:hover': {
    background: 'rgba(203,213,225,0.72)',
  },
};

const RoutePlanner = ({ vertiports = [], onRouteCalculated, onClearRoute }) => {
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSwap = () => {
    setFrom(to);
    setTo(from);
    setRoute(null);
    setError('');
    onClearRoute();
  };

  const handleFindRoute = async () => {
    if (!from || !to) return;
    setLoading(true);
    setError('');
    try {
      const usesDbVertiports = Number.isInteger(from.id) && Number.isInteger(to.id);
      const endpointPayload = usesDbVertiports
        ? { from_vertiport_id: from.id, to_vertiport_id: to.id }
        : {
            from_point: { lat: from.lat, lng: from.lng, name: from.name },
            to_point: { lat: to.lat, lng: to.lng, name: to.name },
          };
      const response = await axios.post('/api/route', {
        ...endpointPayload,
        constraints: {
          avoid_nfz: true,
          avoid_obstacles: true,
          max_wind_kmh: 35,
        },
      });
      const result = {
        ...response.data,
        fromVertiport: from,
        toVertiport: to,
      };
      setRoute(result);
      onRouteCalculated(result);
    } catch (err) {
      setRoute(null);
      onClearRoute();
      setError(err.response?.data?.message || err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setFrom(null);
    setTo(null);
    setRoute(null);
    setError('');
    onClearRoute();
  };

  return (
    <Paper
      sx={{
        position: 'absolute',
        top: { xs: 72, md: '50%' },
        left: 16,
        transform: { xs: 'none', md: 'translateY(-50%)' },
        zIndex: 10,
        pointerEvents: 'auto',
        width: { xs: 'calc(100vw - 48px)', sm: 320 },
        background: 'rgba(2, 6, 23, 0.92)',
        backdropFilter: 'blur(14px)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '14px',
        maxHeight: { xs: 'calc(100vh - 96px)', md: 'calc(100vh - 180px)' },
        overflowX: 'hidden',
        overflowY: 'auto',
        ...scrollSx,
      }}
    >
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 1 }}>
        <FlightIcon sx={{ fontSize: 16, color: '#b65f70' }} />
        <Typography sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Route Planner
        </Typography>
      </Box>

      <Box sx={{ p: 2 }}>
        {/* From selector */}
        <Autocomplete
          options={vertiports.filter((vp) => vp.id !== to?.id)}
          getOptionLabel={(vp) => vp.name}
          value={from}
          onChange={(_, val) => { setFrom(val); setRoute(null); setError(''); onClearRoute(); }}
          size="small"
          renderInput={(params) => (
            <TextField {...params} label="From" placeholder="Select departure" sx={autoSx} />
          )}
          renderOption={(props, vp) => (
            <Box component="li" {...props} sx={{ fontSize: '0.8rem', color: '#e2e8f0', '&:hover': { background: 'rgba(182,95,112,0.1)' } }}>
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
              '&:hover': { color: '#e2e8f0', background: 'rgba(182,95,112,0.1)' },
            }}
          >
            <SwapVertIcon sx={{ fontSize: 16 }} />
          </Button>
        </Box>

        {/* To selector */}
        <Autocomplete
          options={vertiports.filter((vp) => vp.id !== from?.id)}
          getOptionLabel={(vp) => vp.name}
          value={to}
          onChange={(_, val) => { setTo(val); setRoute(null); setError(''); onClearRoute(); }}
          size="small"
          renderInput={(params) => (
            <TextField {...params} label="To" placeholder="Select arrival" sx={autoSx} />
          )}
          renderOption={(props, vp) => (
            <Box component="li" {...props} sx={{ fontSize: '0.8rem', color: '#e2e8f0', '&:hover': { background: 'rgba(182,95,112,0.1)' } }}>
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
            background: 'linear-gradient(135deg, #b65f70, #6d28d9)',
            boxShadow: '0 4px 14px rgba(139,92,246,0.3)',
            '&:hover': { boxShadow: '0 4px 20px rgba(139,92,246,0.45)' },
            '&:disabled': { opacity: 0.4 },
          }}
          startIcon={loading ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <FlightIcon sx={{ fontSize: 16 }} />}
        >
          {loading ? 'Calculating...' : 'Find Route'}
        </Button>

        {error && <Alert severity="error" sx={{ mt: 1.5, fontSize: '0.72rem' }}>{error}</Alert>}

        {/* Route result */}
        {route && (
          <>
            <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.06)' }} />
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography sx={{ fontSize: '0.7rem', color: '#475569', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                Route Details
              </Typography>
              <Chip
                label={route.safety_status || 'simulated'}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.62rem',
                  color: route.is_safe ? '#86efac' : '#fca5a5',
                  background: route.is_safe ? 'rgba(34,197,94,0.16)' : 'rgba(239,68,68,0.16)',
                  fontWeight: 700,
                }}
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
              <StatBox icon={<StraightenIcon sx={{ fontSize: 14, color: '#60a5fa' }} />} label="Distance" value={`${route.distance_km} km`} />
              <StatBox icon={<AccessTimeIcon sx={{ fontSize: 14, color: '#34d399' }} />} label="Duration" value={`${route.duration_min} min`} />
              <StatBox icon={<PaymentIcon sx={{ fontSize: 14, color: '#f59e0b' }} />} label="Price" value={`${route.price_tl} TL`} />
            </Box>

            {route.warnings?.length > 0 && (
              <Alert severity="warning" sx={{ mt: 1.5, fontSize: '0.72rem' }}>
                {route.warnings.slice(0, 2).join(' ')}
              </Alert>
            )}

            {route.weather && (
              <Box sx={{ mt: 1.5, background: 'rgba(255,255,255,0.04)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', p: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.8 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                    <AirIcon sx={{ fontSize: 14, color: '#b65f70' }} />
                    <Typography sx={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Weather
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.62rem', color: route.weather.is_fallback ? '#fbbf24' : '#86efac', fontWeight: 700 }}>
                    {route.weather.source === 'open_meteo' ? 'Open-Meteo' : 'Fallback'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.7 }}>
                  <WeatherMetric label="10m wind" value={formatWind(route.weather.wind_kmh)} />
                  <WeatherMetric label="80m wind" value={formatWind(route.weather.wind_80m_kmh)} />
                  <WeatherMetric label="120m wind" value={formatWind(route.weather.wind_120m_kmh)} />
                  <WeatherMetric label="Gust" value={formatWind(route.weather.wind_gusts_kmh)} />
                </Box>
                <Typography sx={{ mt: 0.8, fontSize: '0.66rem', color: '#64748b', textTransform: 'capitalize' }}>
                  Condition: {route.weather.condition || 'standard'}
                </Typography>
              </Box>
            )}

            {route.conflicts?.length > 0 && (
              <Box sx={{ mt: 1.5 }}>
                {route.conflicts.slice(0, 2).map((conflict, index) => (
                  <Typography key={`${conflict.type}-${index}`} sx={{ fontSize: '0.7rem', color: conflict.severity === 'blocker' ? '#fca5a5' : '#fbbf24', lineHeight: 1.5 }}>
                    {conflict.message}
                  </Typography>
                ))}
              </Box>
            )}

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

const formatWind = (value) => (value === null || value === undefined ? 'n/a' : `${Number(value).toFixed(1)} km/h`);

const WeatherMetric = ({ label, value }) => (
  <Box sx={{ background: 'rgba(15,23,42,0.5)', borderRadius: '6px', p: 0.7 }}>
    <Typography sx={{ fontSize: '0.56rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</Typography>
    <Typography sx={{ fontSize: '0.68rem', color: '#cbd5e1', fontWeight: 700 }}>{value}</Typography>
  </Box>
);

export default RoutePlanner;
