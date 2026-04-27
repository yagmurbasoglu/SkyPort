import React, { useState } from 'react';
import {
  Box, Paper, Typography, Button, Divider, Autocomplete,
  TextField, CircularProgress, Alert, Chip, Modal, Fade, Backdrop, IconButton
} from '@mui/material';
import FlightIcon from '@mui/icons-material/Flight';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import StraightenIcon from '@mui/icons-material/Straighten';
import PaymentIcon from '@mui/icons-material/Payment';
import AirIcon from '@mui/icons-material/Air';
import CloseIcon from '@mui/icons-material/Close';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import axios from 'axios';

const autoSx = {
  '& .MuiOutlinedInput-root': {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '8px',
    fontFamily: 'Inter',
    fontSize: '0.82rem',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
    '&.Mui-focused fieldset': { borderColor: '#e17b8f' },
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

const routeStatusConfig = (route) => {
  const status = route?.safety_status || 'simulated';
  if (status === 'safe') {
    return {
      color: '#86efac',
      background: 'rgba(34,197,94,0.16)',
      label: 'safe',
      summary: 'Safe route ready for flight.',
    };
  }
  if (status === 'warning') {
    return {
      color: '#fbbf24',
      background: 'rgba(245,158,11,0.16)',
      label: 'warning',
      summary: 'Route found with warnings. Review airspace and weather before flight.',
    };
  }
  if (status === 'blocked' || route?.is_safe === false) {
    return {
      color: '#fca5a5',
      background: 'rgba(239,68,68,0.16)',
      label: 'blocked',
      summary: route?.blocking_reason || 'No safe route is currently available.',
    };
  }
  return {
    color: '#cbd5e1',
    background: 'rgba(148,163,184,0.16)',
    label: status,
    summary: 'Route simulation ready.',
  };
};

const blockingCopy = (route) => {
  if (!route?.blocking_type) return null;
  if (route.blocking_type === 'obstacle') return 'Blocked by obstacle';
  if (route.blocking_type === 'nfz') return 'Blocked by no-fly zone';
  if (route.blocking_type === 'weather') return 'Blocked by weather';
  return route.blocking_reason || 'Blocked route';
};

const obstacleDataCopy = (route) => {
  if (!route) return null;
  if (route.obstacle_data_status === 'available') {
    return {
      severity: 'success',
      text: `Obstacle data ready (${route.obstacle_feature_count} building features loaded).`,
    };
  }
  return {
    severity: 'warning',
    text: 'Obstacle data missing for this corridor. Ask an expert to run geodata ingest.',
  };
};

const RoutePlanner = ({ vertiports = [], onRouteCalculated, onClearRoute }) => {
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [route, setRoute] = useState(null);
  const [error, setError] = useState('');
  const [showBoardingPass, setShowBoardingPass] = useState(false);

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

  const statusMeta = routeStatusConfig(route);
  const shortBlockingCopy = blockingCopy(route);
  const obstacleInfo = obstacleDataCopy(route);

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
        top: '50%',
        left: 24,
        transform: 'translateY(-50%)',
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
        <FlightIcon sx={{ fontSize: 16, color: '#e17b8f' }} />
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
            <Box component="li" {...props} sx={{ fontSize: '0.8rem', color: '#e2e8f0', '&:hover': { background: 'rgba(225,123,143,0.1)' } }}>
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
              '&:hover': { color: '#e2e8f0', background: 'rgba(225,123,143,0.1)' },
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
            <Box component="li" {...props} sx={{ fontSize: '0.8rem', color: '#e2e8f0', '&:hover': { background: 'rgba(225,123,143,0.1)' } }}>
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
            background: 'linear-gradient(135deg, #e17b8f, #6d28d9)',
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
                label={statusMeta.label}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.62rem',
                  color: statusMeta.color,
                  background: statusMeta.background,
                  fontWeight: 700,
                }}
              />
            </Box>

            <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', lineHeight: 1.5, mb: 1.2 }}>
              {statusMeta.summary}
            </Typography>

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

            {obstacleInfo && (
              <Alert severity={obstacleInfo.severity} sx={{ mt: 1.5, fontSize: '0.72rem' }}>
                {obstacleInfo.text}
              </Alert>
            )}

            {route.weather && (
              <Box sx={{ mt: 1.5, background: 'rgba(255,255,255,0.04)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', p: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.8 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                    <AirIcon sx={{ fontSize: 14, color: '#e17b8f' }} />
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

            {shortBlockingCopy && (
              <Alert severity="error" sx={{ mt: 1.5, fontSize: '0.72rem' }}>
                {shortBlockingCopy}
              </Alert>
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

            {!route.is_safe && (
              <Button
                fullWidth
                disabled
                sx={{
                  mt: 1.5,
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  color: '#fca5a5',
                  border: '1px solid rgba(248,113,113,0.32)',
                  background: 'rgba(127,29,29,0.18)',
                }}
              >
                Continue disabled for blocked route
              </Button>
            )}

            {route.is_safe && (
              <Button
                fullWidth
                onClick={() => setShowBoardingPass(true)}
                sx={{
                  mt: 2,
                  textTransform: 'uppercase',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  letterSpacing: '0.1em',
                  color: '#fff',
                  background: 'linear-gradient(45deg, #e17b8f, #f43f5e)',
                  boxShadow: '0 4px 14px rgba(225,123,143,0.4)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #f43f5e, #e17b8f)',
                    boxShadow: '0 6px 20px rgba(225,123,143,0.6)',
                  }
                }}
              >
                Book Flight
              </Button>
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

      {/* ── Futuristic Boarding Pass Modal ── */}
      <Modal
        open={showBoardingPass}
        onClose={() => setShowBoardingPass(false)}
        closeAfterTransition
        BackdropComponent={Backdrop}
        BackdropProps={{ timeout: 500, sx: { backdropFilter: 'blur(8px)' } }}
      >
        <Fade in={showBoardingPass}>
          <Box sx={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 320, background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(32px) saturate(200%)',
            border: '1px solid rgba(225, 123, 143, 0.3)',
            borderRadius: '24px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
            overflow: 'hidden', p: 0, outline: 'none'
          }}>
            {/* Header */}
            <Box sx={{ background: 'linear-gradient(135deg, #e17b8f, #be123c)', p: 3, position: 'relative' }}>
              <IconButton onClick={() => setShowBoardingPass(false)} sx={{ position: 'absolute', top: 8, right: 8, color: '#fff' }}>
                <CloseIcon fontSize="small" />
              </IconButton>
              <Typography sx={{ color: '#fff', fontSize: '0.7rem', fontWeight: 600, opacity: 0.8, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                SkyPort Boarding Pass
              </Typography>
              <Typography sx={{ color: '#fff', fontSize: '1.4rem', fontWeight: 800, mt: 0.5 }}>
                First Class
              </Typography>
            </Box>
            
            {/* Body */}
            <Box sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase' }}>From</Typography>
                  <Typography sx={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 700 }} noWrap>{route?.from_point?.name || 'Origin'}</Typography>
                </Box>
                <FlightIcon sx={{ color: '#e17b8f', transform: 'rotate(90deg)', opacity: 0.5, mt: 1, mx: 1, flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                  <Typography sx={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase' }}>To</Typography>
                  <Typography sx={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 700 }} noWrap>{route?.to_point?.name || 'Destination'}</Typography>
                </Box>
              </Box>
              
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', borderStyle: 'dashed', my: 2 }} />
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Box>
                  <Typography sx={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase' }}>Flight</Typography>
                  <Typography sx={{ fontSize: '0.9rem', color: '#e2e8f0', fontWeight: 700 }}>SP-{Math.floor(Math.random() * 900) + 100}</Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase' }}>Gate</Typography>
                  <Typography sx={{ fontSize: '0.9rem', color: '#e2e8f0', fontWeight: 700 }}>04</Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase' }}>Boarding</Typography>
                  <Typography sx={{ fontSize: '0.9rem', color: '#e2e8f0', fontWeight: 700 }}>10 Min</Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, background: 'rgba(34, 197, 94, 0.1)', p: 1.5, borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                <WorkspacePremiumIcon sx={{ color: '#4ade80', fontSize: 18 }} />
                <Typography sx={{ color: '#4ade80', fontSize: '0.7rem', fontWeight: 600 }}>
                  Zero Emission Flight - 4.2kg CO₂ Saved
                </Typography>
              </Box>
            </Box>

            {/* QR Code */}
            <Box sx={{ background: 'rgba(255,255,255,0.02)', p: 3, textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <QrCode2Icon sx={{ fontSize: 64, color: '#e17b8f', opacity: 0.9 }} />
              <Typography sx={{ fontSize: '0.6rem', color: '#64748b', mt: 1, letterSpacing: '0.1em' }}>
                SCAN AT HELIPAD
              </Typography>
            </Box>
          </Box>
        </Fade>
      </Modal>

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
