import React, { useEffect, useMemo, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import {
  Box, Paper, Typography, Button, Divider, Autocomplete,
  TextField, CircularProgress, Alert, Chip, Modal, Fade, Backdrop, LinearProgress, MenuItem
} from '@mui/material';
import FlightIcon from '@mui/icons-material/Flight';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import StraightenIcon from '@mui/icons-material/Straighten';
import PaymentIcon from '@mui/icons-material/Payment';
import AirIcon from '@mui/icons-material/Air';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import axios from 'axios';
import { getApiErrorMessage } from '../../utils/apiError';

// ─── Flight number & gate helpers ─────────────────────────────────────────────
const GATES = ['A1','A2','A3','B1','B2','B3','C1','C2','C4','D2','D5','D8'];

const resolvePublicAppBaseUrl = () => {
  const configured = process.env.REACT_APP_PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  return window.location.origin.replace(/\/+$/, '');
};

const buildBoardingPassUrl = ({ flightNo, gate, route, fromName, toName, issuedAt, departureDate, departureTime, passengerCount }) => {
  const params = new URLSearchParams({
    flight: flightNo,
    gate,
    from: fromName || 'Origin',
    to: toName || 'Destination',
    distance: String(route?.distance_km ?? ''),
    duration: String(route?.duration_min ?? ''),
    price: String(route?.price_tl ?? ''),
    issued_at: issuedAt,
    departure_date: departureDate || '',
    departure_time: departureTime || '',
    passengers: String(passengerCount ?? 1),
  });
  return `${resolvePublicAppBaseUrl()}/boarding-pass?${params.toString()}`;
};

const SLOT_INTERVAL_MIN = 30;
const MAX_PASSENGERS = 2;
const OPERATION_START_HOUR = 9;
const OPERATION_END_HOUR = 21;

const toDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildDailySlots = () => {
  const slots = [];
  for (let hour = OPERATION_START_HOUR; hour <= OPERATION_END_HOUR; hour += 1) {
    for (let minute = 0; minute < 60; minute += SLOT_INTERVAL_MIN) {
      if (hour === OPERATION_END_HOUR && minute > 0) continue;
      slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    }
  }
  return slots;
};

const parseSlotDate = (dateValue, timeValue) => {
  if (!dateValue || !timeValue) return null;
  const [year, month, day] = dateValue.split('-').map(Number);
  const [hours, minutes] = timeValue.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
};

const getNextFlightNo = () => {
  const stored = parseInt(localStorage.getItem('skyport_last_flight_no') || '100', 10);
  const next = stored + 1;
  localStorage.setItem('skyport_last_flight_no', String(next));
  return `SP-${next}`;
};

const randomGate = () => GATES[Math.floor(Math.random() * GATES.length)];
const isDbVertiportId = (id) => Number.isInteger(id);
const readFlightHistory = (storageKey) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const hasLocalSlotConflict = (history, { fromVertiportId, departureDate, departureTime }) => (
  history.some((flight) => (
    String(flight.from_vertiport_id ?? '') === String(fromVertiportId ?? '')
    && String(flight.departure_date ?? '') === String(departureDate ?? '')
    && String(flight.departure_time ?? '') === String(departureTime ?? '')
  ))
);

const saveFlightHistory = (storageKey, entry) => {
  const history = readFlightHistory(storageKey);
  history.unshift(entry); // newest first
  localStorage.setItem(storageKey, JSON.stringify(history.slice(0, 20)));
};

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
  '& .MuiInputLabel-root': { color: '#cbd5e1', fontFamily: 'Inter', fontSize: '0.82rem' },
  '& .MuiInputBase-input': { color: '#e2e8f0', fontFamily: 'Inter', fontSize: '0.82rem' },
  '& .MuiInputBase-input::-webkit-calendar-picker-indicator': {
    filter: 'invert(1) brightness(1.35)',
    opacity: 0.92,
    cursor: 'pointer',
  },
  '& .MuiAutocomplete-popupIndicator': { color: '#475569' },
  '& .MuiAutocomplete-clearIndicator': { color: '#475569' },
  '& .MuiSvgIcon-root': { color: '#cbd5e1' },
  '& .MuiSelect-icon': { color: '#cbd5e1' },
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

const RoutePlanner = ({ vertiports = [], onRouteCalculated, onClearRoute, onFlightBooked, bookingRefreshKey = 0, historyStorageKey }) => {
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const [route, setRoute] = useState(null);
  const [error, setError] = useState('');
  const [showBoardingPass, setShowBoardingPass] = useState(false);
  const [flightNo, setFlightNo] = useState('');
  const [gate, setGate] = useState('');
  const [issuedAtLabel, setIssuedAtLabel] = useState('');
  const [boardingPassUrl, setBoardingPassUrl] = useState('');
  const [departureDate, setDepartureDate] = useState(() => toDateInputValue(new Date()));
  const [departureTime, setDepartureTime] = useState('');
  const [passengerCount, setPassengerCount] = useState(1);
  const [occupiedSlots, setOccupiedSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const printTicketRef = useRef(null);

  useEffect(() => {
    if (!departureDate || !isDbVertiportId(from?.id)) {
      setOccupiedSlots([]);
      setSlotsLoading(false);
      return undefined;
    }

    let active = true;
    setSlotsLoading(true);
    axios.get('/api/bookings/slots', {
      params: {
        from_vertiport_id: from.id,
        departure_date: departureDate,
      },
    }).then((response) => {
      if (active) {
        setOccupiedSlots(Array.isArray(response.data?.booked_slots) ? response.data.booked_slots : []);
      }
    }).catch(() => {
      if (active) {
        setOccupiedSlots([]);
      }
    }).finally(() => {
      if (active) {
        setSlotsLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [bookingRefreshKey, departureDate, from?.id]);

  useEffect(() => {
    if (!loading) {
      setLoadingSeconds(0);
      return undefined;
    }
    const interval = window.setInterval(() => {
      setLoadingSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [loading]);

  const availableSlots = useMemo(() => {
    const allSlots = buildDailySlots();
    if (!departureDate) return allSlots;

    const now = new Date();
    const today = toDateInputValue(now);
    let filteredSlots = allSlots;
    if (departureDate === today) {
      filteredSlots = allSlots.filter((slot) => {
        const slotDate = parseSlotDate(departureDate, slot);
        return slotDate && slotDate.getTime() > now.getTime() + 15 * 60 * 1000;
      });
    }

    return filteredSlots.filter((slot) => !occupiedSlots.includes(slot));
  }, [departureDate, occupiedSlots]);

  useEffect(() => {
    if (!availableSlots.length) {
      setDepartureTime('');
      return;
    }
    if (!availableSlots.includes(departureTime)) {
      setDepartureTime(availableSlots[0]);
    }
  }, [availableSlots, departureTime]);

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
        constraints: { avoid_nfz: true, avoid_obstacles: true, max_wind_kmh: 120 },
      });
      const result = { ...response.data, fromVertiport: from, toVertiport: to };
      setRoute(result);
      onRouteCalculated(result);
    } catch (err) {
      setRoute(null);
      onClearRoute();
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleBookFlight = async () => {
    if (!route || !departureDate || !departureTime || bookingSubmitting) {
      setError('Select an available departure date and time before booking.');
      return;
    }
    const fromVertiportId = route?.fromVertiport?.id ?? from?.id ?? null;
    const toVertiportId = route?.toVertiport?.id ?? to?.id ?? null;
    const localHistory = readFlightHistory(historyStorageKey);
    if (hasLocalSlotConflict(localHistory, { fromVertiportId, departureDate, departureTime })) {
      setError('You already created a booking for this departure slot.');
      return;
    }
    const fn = getNextFlightNo();
    const g = randomGate();
    const issuedAt = new Date().toLocaleString('tr-TR');
    let bookingId = null;
    setBookingSubmitting(true);
    if (isDbVertiportId(fromVertiportId)) {
      try {
        const bookingResponse = await axios.post('/api/bookings', {
          route_id: route?.route_id ?? null,
          from_vertiport_id: fromVertiportId,
          to_vertiport_id: isDbVertiportId(toVertiportId) ? toVertiportId : null,
          flight_no: fn,
          gate: g,
          departure_date: departureDate,
          departure_time: departureTime,
          passenger_count: passengerCount,
        });
        bookingId = bookingResponse?.data?.id ?? null;
        setOccupiedSlots((prev) => (
          prev.includes(departureTime)
            ? prev
            : [...prev, departureTime].sort((left, right) => left.localeCompare(right))
        ));
      } catch (err) {
        const detail = err.response?.data?.detail || err.response?.data?.message || err.message;
        setError(detail);
        if (err.response?.status === 409) {
          setOccupiedSlots((prev) => (
            prev.includes(departureTime)
              ? prev
              : [...prev, departureTime].sort((left, right) => left.localeCompare(right))
          ));
          setDepartureTime('');
        }
        return;
      } finally {
        setBookingSubmitting(false);
      }
    }
    setFlightNo(fn);
    setGate(g);
    setIssuedAtLabel(issuedAt);
    const livePassUrl = buildBoardingPassUrl({
      flightNo: fn,
      gate: g,
      route,
      fromName: route?.fromVertiport?.name || from?.name || 'Origin',
      toName: route?.toVertiport?.name || to?.name || 'Destination',
      issuedAt,
      departureDate,
      departureTime,
      passengerCount,
    });
    setBoardingPassUrl(livePassUrl);
    const entry = {
      booking_id: bookingId,
      flightNo: fn,
      gate: g,
      from: route?.fromVertiport?.name || from?.name || 'Origin',
      to: route?.toVertiport?.name || to?.name || 'Destination',
      from_vertiport_id: fromVertiportId,
      to_vertiport_id: toVertiportId,
      distance_km: route?.distance_km,
      duration_min: route?.duration_min,
      price_tl: route?.price_tl,
      date: issuedAt,
      departure_date: departureDate,
      departure_time: departureTime,
      passenger_count: passengerCount,
      boarding_pass_url: livePassUrl,
    };
    saveFlightHistory(historyStorageKey, entry);
    onFlightBooked?.(entry);
    setShowBoardingPass(true);
    setBookingSubmitting(false);
  };

  const handleClear = () => {
    setFrom(null); setTo(null); setRoute(null); setError(''); onClearRoute();
  };

  const statusMeta = routeStatusConfig(route);
  const shortBlockingCopy = blockingCopy(route);
  const obstacleInfo = obstacleDataCopy(route);

  const fromName = route?.fromVertiport?.name || from?.name || '';
  const toName   = route?.toVertiport?.name   || to?.name   || '';
  const currentIssuedAt = issuedAtLabel || new Date().toLocaleString('tr-TR');
  const usesLocalhostPass = boardingPassUrl.includes('localhost') || boardingPassUrl.includes('127.0.0.1');
  const qrData   = encodeURIComponent(boardingPassUrl || buildBoardingPassUrl({
    flightNo,
    gate,
    route,
    fromName,
    toName,
    issuedAt: currentIssuedAt,
    departureDate,
    departureTime,
    passengerCount,
  }));
  const qrUrl    = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrData}&bgcolor=0f172a&color=e17b8f&margin=8`;

  const handleDownloadPDF = async () => {
    if (!printTicketRef.current) return;
    try {
      const canvas = await html2canvas(printTicketRef.current, {
        scale: 2.4,
        useCORS: true,
        backgroundColor: null,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const renderWidth = pageWidth - (margin * 2);
      const renderHeight = Math.min(pageHeight - (margin * 2), (canvas.height * renderWidth) / canvas.width);
      const offsetY = (pageHeight - renderHeight) / 2;
      pdf.addImage(imgData, 'PNG', margin, offsetY, renderWidth, renderHeight);
      pdf.save(`SkyPort-${flightNo}-Ticket.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
    }
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
              <StatBox icon={<PaymentIcon sx={{ fontSize: 14, color: '#f59e0b' }} />} label="Price" value={`TL ${route.price_tl}`} />
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

            {route.is_safe && (
              <Box sx={{ mt: 1.6, background: 'rgba(255,255,255,0.04)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', p: 1.2 }}>
                <Typography sx={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1 }}>
                  Flight Booking Details
                </Typography>
                <TextField
                  fullWidth
                  label="Departure Date"
                  type="date"
                  size="small"
                  value={departureDate}
                  onChange={(event) => setDepartureDate(event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ min: toDateInputValue(new Date()) }}
                  sx={{ ...autoSx, mb: 1.1 }}
                />
                <TextField
                  fullWidth
                  select
                  label="Available Time Slot"
                  size="small"
                  value={departureTime}
                  onChange={(event) => setDepartureTime(event.target.value)}
                  disabled={slotsLoading || !availableSlots.length}
                  helperText={
                    slotsLoading
                      ? 'Checking live slot availability...'
                      : (availableSlots.length ? 'Booked slots are automatically hidden.' : 'No slots left for the selected date.')
                  }
                  sx={{ ...autoSx, mb: 1.1 }}
                >
                  {availableSlots.map((slot) => (
                    <MenuItem key={slot} value={slot}>{slot}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  fullWidth
                  select
                  label="Passenger Count"
                  size="small"
                  value={passengerCount}
                  onChange={(event) => setPassengerCount(Number(event.target.value))}
                  helperText="Passenger count is limited to 2 per booking."
                  sx={autoSx}
                >
                  {[1, 2].map((count) => (
                    <MenuItem key={count} value={count}>{count}</MenuItem>
                  ))}
                </TextField>
                <Typography sx={{ mt: 1, color: '#94a3b8', fontSize: '0.64rem', lineHeight: 1.45 }}>
                  Simulation scheduling only. No payment or commercial ticketing is processed.
                </Typography>
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
                  onClick={handleBookFlight}
                  disabled={!departureDate || !departureTime || slotsLoading || bookingSubmitting}
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
                {bookingSubmitting ? 'Booking...' : 'Book Flight'}
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

      {/* ── Boarding Pass Modal ── */}
      <Modal open={loading} closeAfterTransition BackdropComponent={Backdrop} BackdropProps={{ timeout: 250, sx: { backdropFilter: 'blur(6px)', background: 'rgba(2,6,23,0.7)' } }}>
        <Fade in={loading}>
          <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 'min(90vw, 360px)', outline: 'none' }}>
            <Paper sx={{ background: 'rgba(2, 6, 23, 0.96)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', boxShadow: '0 28px 80px rgba(0,0,0,0.55)', p: 2.4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1 }}>
                <CircularProgress size={22} sx={{ color: '#e17b8f' }} />
                <Box>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '0.92rem' }}>
                    Calculating Safe Route
                  </Typography>
                  <Typography sx={{ color: '#94a3b8', fontSize: '0.72rem', mt: 0.25 }}>
                    Airspace, weather, and obstacle checks are running now.
                  </Typography>
                </Box>
              </Box>
              <LinearProgress
                sx={{
                  mt: 1.6,
                  height: 7,
                  borderRadius: '999px',
                  bgcolor: 'rgba(255,255,255,0.08)',
                  '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg,#e17b8f,#60a5fa)' },
                }}
              />
              <Typography sx={{ color: '#64748b', fontSize: '0.68rem', mt: 1.1 }}>
                Elapsed time: {loadingSeconds}s
              </Typography>
            </Paper>
          </Box>
        </Fade>
      </Modal>

      <Modal open={showBoardingPass} onClose={() => setShowBoardingPass(false)} closeAfterTransition BackdropComponent={Backdrop} BackdropProps={{ timeout: 500, sx: { backdropFilter: 'blur(8px)' } }}>
        <Fade in={showBoardingPass}>
          <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', outline: 'none' }}>
            <Box sx={{ width: 320, background: '#0f172a', border: '1px solid rgba(225,123,143,0.3)', borderRadius: '24px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', overflow: 'hidden' }}>
              {/* Card header */}
              <Box sx={{ background: 'linear-gradient(135deg,#e17b8f,#be123c)', p: 3, position: 'relative' }}>
                <Typography sx={{ color: '#fff', fontSize: '0.65rem', fontWeight: 600, opacity: 0.8, letterSpacing: '0.12em', textTransform: 'uppercase' }}>SkyPort Boarding Pass</Typography>
                <Typography sx={{ color: '#fff', fontSize: '1.4rem', fontWeight: 800, mt: 0.3 }}>First Class</Typography>
                <FlightIcon sx={{ position: 'absolute', bottom: -10, right: 10, fontSize: 80, color: 'rgba(255,255,255,0.08)', transform: 'rotate(45deg)' }} />
              </Box>

              {/* Route row */}
              <Box sx={{ px: 3, pt: 2.5, pb: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.6rem', color: '#64748b', textTransform: 'uppercase' }}>From</Typography>
                  <Typography sx={{ fontSize: '0.82rem', color: '#e2e8f0', fontWeight: 700 }} noWrap>{fromName || 'Origin'}</Typography>
                </Box>
                <FlightIcon sx={{ color: '#e17b8f', transform: 'rotate(90deg)', opacity: 0.5, mx: 1, flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                  <Typography sx={{ fontSize: '0.6rem', color: '#64748b', textTransform: 'uppercase' }}>To</Typography>
                  <Typography sx={{ fontSize: '0.82rem', color: '#e2e8f0', fontWeight: 700 }} noWrap>{toName || 'Destination'}</Typography>
                </Box>
              </Box>

              <Divider sx={{ mx: 3, mt: 2, borderColor: 'rgba(255,255,255,0.06)', borderStyle: 'dashed' }} />

              {/* Flight details row */}
              <Box sx={{ px: 3, py: 1.5, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.1 }}>
                <TicketMetric label="Flight" value={flightNo} />
                <TicketMetric label="Gate" value={gate} />
                <TicketMetric label="Departure Date" value={departureDate || '-'} />
                <TicketMetric label="Departure Time" value={departureTime || '-'} />
                <TicketMetric label="Passengers" value={String(passengerCount)} />
                <TicketMetric label="Duration" value={`${route?.duration_min ?? '-'} min`} />
                <TicketMetric label="Price" value={`TL ${route?.price_tl ?? '-'}`} />
                <TicketMetric label="Booking Rule" value={`Max ${MAX_PASSENGERS} pax`} />
              </Box>

              <Box sx={{ px: 3, pb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, background: 'rgba(34,197,94,0.1)', p: 1.2, borderRadius: '8px', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <WorkspacePremiumIcon sx={{ color: '#4ade80', fontSize: 16 }} />
                  <Typography sx={{ color: '#4ade80', fontSize: '0.68rem', fontWeight: 600 }}>
                    Zero emission flight · passenger count is limited to 2.
                  </Typography>
                </Box>
              </Box>

              {/* QR Code */}
              <Box sx={{ background: 'rgba(255,255,255,0.02)', p: 2.5, textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <img src={qrUrl} alt="Boarding QR" style={{ width: 140, height: 140, borderRadius: 8, background: '#0f172a' }} />
                </Box>
                <Typography sx={{ fontSize: '0.58rem', color: '#64748b', mt: 1, letterSpacing: '0.1em' }}>SCAN AT HELIPAD — {flightNo}</Typography>
                <Typography sx={{ fontSize: '0.62rem', color: '#94a3b8', mt: 1.2, lineHeight: 1.5 }}>
                  Scanning this QR opens the live SkyPort boarding pass page.
                </Typography>
                {usesLocalhostPass && (
                  <Typography sx={{ fontSize: '0.62rem', color: '#fbbf24', mt: 1.1, lineHeight: 1.5 }}>
                    This QR currently points to localhost. For phone access, open the app from your PC IP or set `REACT_APP_PUBLIC_APP_URL`.
                  </Typography>
                )}
              </Box>
            </Box>

            <Box
              sx={{
                position: 'fixed',
                left: -10000,
                top: 0,
                pointerEvents: 'none',
                opacity: 0,
              }}
            >
              <Box
                ref={printTicketRef}
                sx={{
                  width: 820,
                  minHeight: 1180,
                  display: 'grid',
                  placeItems: 'center',
                  px: 5,
                  py: 6,
                  background:
                    'radial-gradient(circle at top, rgba(225,123,143,0.18), transparent 32%), linear-gradient(180deg, #020617 0%, #0f172a 100%)',
                }}
              >
                <Box
                  sx={{
                    width: '100%',
                    maxWidth: 520,
                    overflow: 'hidden',
                    borderRadius: '28px',
                    border: '1px solid rgba(225,123,143,0.24)',
                    background: 'rgba(15, 23, 42, 0.96)',
                    boxShadow: '0 28px 80px rgba(0,0,0,0.55)',
                  }}
                >
                  <Box sx={{ p: 3.2, background: 'linear-gradient(135deg, #e17b8f, #be123c)', position: 'relative' }}>
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.8,
                        px: 1.25,
                        py: 0.75,
                        borderRadius: '999px',
                        bgcolor: 'rgba(255,255,255,0.12)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: '#fff',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        lineHeight: 1.1,
                      }}
                    >
                      <DownloadIcon sx={{ fontSize: 15, color: '#fff' }} />
                      <Box component="span">Passenger Boarding Pass</Box>
                    </Box>
                    <Typography sx={{ color: '#fff', fontSize: '2rem', fontWeight: 900, mt: 1.3 }}>
                      {flightNo}
                    </Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.84)', fontSize: '0.92rem', mt: 0.45 }}>
                      Gate {gate} - Issued {currentIssuedAt}
                    </Typography>
                    <FlightIcon sx={{ position: 'absolute', right: 18, bottom: -10, fontSize: 96, color: 'rgba(255,255,255,0.08)', transform: 'rotate(45deg)' }} />
                  </Box>

                  <Box sx={{ px: 3.2, pt: 3.2, pb: 3.2 }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 56px minmax(0, 1fr)', alignItems: 'center', gap: 1.4 }}>
                      <PrintableRouteColumn label="From" value={fromName || 'Origin'} align="left" />
                      <Box sx={{ display: 'grid', placeItems: 'center' }}>
                        <FlightIcon sx={{ color: '#e17b8f', opacity: 0.55, transform: 'rotate(90deg)', flexShrink: 0, fontSize: 28 }} />
                      </Box>
                      <PrintableRouteColumn label="To" value={toName || 'Destination'} align="right" />
                    </Box>

                    <Divider sx={{ my: 2.5, borderColor: 'rgba(255,255,255,0.07)', borderStyle: 'dashed' }} />

                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1.2 }}>
                      <PrintableMetricCard label="Distance" value={`${route?.distance_km ?? '-'} km`} />
                      <PrintableMetricCard label="Duration" value={`${route?.duration_min ?? '-'} min`} />
                      <PrintableMetricCard label="Price" value={`TL ${route?.price_tl ?? '-'}`} />
                    </Box>

                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.2, mt: 1.2 }}>
                      <PrintableMetricCard label="Date" value={departureDate || '-'} />
                      <PrintableMetricCard label="Time" value={departureTime || '-'} />
                      <PrintableMetricCard label="Passengers" value={String(passengerCount)} />
                      <PrintableMetricCard label="Booking Rule" value={`Max ${MAX_PASSENGERS} pax`} />
                    </Box>

                    <Box sx={{ mt: 2.2, display: 'flex', alignItems: 'center', gap: 1.2, p: 1.3, borderRadius: '12px', bgcolor: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.2)' }}>
                      <WorkspacePremiumIcon sx={{ color: '#4ade80', fontSize: 18 }} />
                      <Typography sx={{ color: '#86efac', fontSize: '0.82rem', fontWeight: 700 }}>
                        Verified live passenger card - passenger limit is 2
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Box>

            {/* Actions (Not part of the printed ticket) */}
            <Box
              sx={{
                width: 360,
                maxWidth: '100%',
                mx: 'auto',
                mt: 1.5,
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 1,
                alignItems: 'stretch',
              }}
            >
              <Button
                variant="contained"
                startIcon={<DownloadIcon sx={{ fontSize: 15 }} />}
                onClick={handleDownloadPDF}
                sx={{
                  minHeight: 72,
                  background: 'linear-gradient(135deg,#e17b8f,#be123c)',
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.76rem',
                  borderRadius: '10px',
                  py: 1.1,
                  px: 1.2,
                  textAlign: 'center',
                  lineHeight: 1.3,
                }}
              >
                Download Ticket
              </Button>
              <Button
                component="a"
                href={boardingPassUrl}
                target="_blank"
                rel="noreferrer"
                sx={{
                  minHeight: 72,
                  bgcolor: 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.76rem',
                  borderRadius: '10px',
                  px: 1.2,
                  textAlign: 'center',
                  lineHeight: 1.3,
                }}
              >
                Open Live Pass
              </Button>
              <Button
                onClick={() => setShowBoardingPass(false)}
                startIcon={<CloseIcon fontSize="small" />}
                sx={{
                  minHeight: 72,
                  bgcolor: 'rgba(255,255,255,0.05)',
                  color: '#fff',
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.76rem',
                  borderRadius: '10px',
                  px: 1.2,
                  textAlign: 'center',
                  lineHeight: 1.3,
                }}
              >
                Close
              </Button>
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

const TicketMetric = ({ label, value }) => (
  <Box sx={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', p: 0.9, border: '1px solid rgba(255,255,255,0.05)' }}>
    <Typography sx={{ fontSize: '0.58rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {label}
    </Typography>
    <Typography sx={{ fontSize: '0.8rem', color: '#e2e8f0', fontWeight: 700, mt: 0.25 }}>
      {value}
    </Typography>
  </Box>
);

const PrintableRouteColumn = ({ label, value, align }) => (
  <Box sx={{ minWidth: 0, textAlign: align }}>
    <Typography sx={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1.2 }}>
      {label}
    </Typography>
    <Typography
      sx={{
        fontSize: '0.95rem',
        color: '#e2e8f0',
        fontWeight: 800,
        lineHeight: 1.24,
        mt: 0.38,
        minHeight: 46,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        overflowWrap: 'anywhere',
      }}
    >
      {value}
    </Typography>
  </Box>
);

const PrintableMetricCard = ({ label, value }) => (
  <Box sx={{ borderRadius: '12px', p: 1.15, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
    <Typography sx={{ fontSize: '0.64rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
      {label}
    </Typography>
    <Typography sx={{ fontSize: '0.88rem', color: '#e2e8f0', fontWeight: 800, mt: 0.3 }}>
      {value}
    </Typography>
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

