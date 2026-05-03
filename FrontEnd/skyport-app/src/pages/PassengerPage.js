import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Chip,
  Fade,
  IconButton,
  Paper,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import MapIcon from '@mui/icons-material/Map';
import FlightIcon from '@mui/icons-material/Flight';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import CloseIcon from '@mui/icons-material/Close';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import HistoryIcon from '@mui/icons-material/History';
import axios from 'axios';

import Navbar from '../components/Navbar';
import PassengerMapView from '../components/passenger/PassengerMapView';
import FilterSidebar from '../components/passenger/FilterSidebar';
import FavoritesSidebar from '../components/passenger/FavoritesSidebar';
import RoutePlanner from '../components/passenger/RoutePlanner';
import { FEATURE_ICONS, FEATURE_LABELS, MOCK_VERTIPORTS } from '../mock/vertiports';
import { useAuth } from '../context/AuthContext';

const DEFAULT_FILTERS = {
  maxDistance: 40,
  minScore: 0,
  maxPrice: 500,
  metro: false,
  low_noise: false,
  parking: false,
  ev_charging: false,
};

const CENTER = { lat: 41.0369, lng: 28.985 };

const distanceKm = (a, b) => {
  const radius = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const hav =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
};

const normalizeDbVertiport = (vp) => {
  let price = Number(vp.price_per_km || 0);
  if (price < 50) {
    const seed = (vp.id * 13) % 270;
    price = 180 + seed;
  }

  return {
    id: vp.id,
    name: vp.name,
    lat: Number(vp.lat),
    lng: Number(vp.lng),
    features: Array.isArray(vp.features) ? vp.features : [],
    suitabilityScore: Number(vp.suitability_score ?? 75),
    pricePerKm: price,
    description: vp.description || 'Active vertiport from the SkyPort operational network.',
    noiseLevel: vp.noise_level || null,
    distanceFromCenter: Number(
      (vp.distance_from_center_km ?? distanceKm(CENTER, { lat: Number(vp.lat), lng: Number(vp.lng) })).toFixed(1)
    ),
  };
};

const scoreColor = (score) => {
  if (score >= 85) return '#22c55e';
  if (score >= 70) return '#eab308';
  return '#ef4444';
};

const PassengerPage = () => {
  const { user } = useAuth();
  const [activeMode, setActiveMode] = useState('map');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [selectedVertiport, setSelectedVertiport] = useState(null);
  const [route, setRoute] = useState(null);
  const [flyToTarget, setFlyToTarget] = useState(null);
  const [vertiports, setVertiports] = useState(MOCK_VERTIPORTS);
  const [usingMockData, setUsingMockData] = useState(false);

  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('skyport_favorites')) || [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    axios.get('/api/favorites')
      .then((response) => {
        if (Array.isArray(response.data)) {
          setFavorites(response.data);
          localStorage.setItem('skyport_favorites', JSON.stringify(response.data));
        }
      })
      .catch(() => {
        // Fall back to localStorage when backend is unavailable.
      });
  }, [user?.id]);

  const toggleFavorite = async (id) => {
    const isFav = favorites.includes(id);
    const next = isFav ? favorites.filter((f) => f !== id) : [...favorites, id];
    setFavorites(next);
    localStorage.setItem('skyport_favorites', JSON.stringify(next));

    try {
      if (isFav) {
        await axios.delete(`/api/favorites/${id}`);
      } else {
        await axios.post(`/api/favorites/${id}`);
      }
    } catch {
      setFavorites(favorites);
      localStorage.setItem('skyport_favorites', JSON.stringify(favorites));
    }
  };

  useEffect(() => {
    let alive = true;
    const params = {};

    if (filters.minScore) params.min_score = filters.minScore;
    if (filters.maxPrice) params.max_price = filters.maxPrice;
    if (filters.maxDistance) params.max_distance_km = filters.maxDistance;
    params.center_lat = CENTER.lat;
    params.center_lng = CENTER.lng;
    if (filters.metro) params.metro = true;
    if (filters.low_noise) params.low_noise = true;
    if (filters.parking) params.parking = true;
    if (filters.ev_charging) params.ev_charging = true;

    axios.get('/api/vertiports', { params })
      .then((response) => {
        if (!alive) return;

        const active = Array.isArray(response.data)
          ? response.data.map(normalizeDbVertiport)
          : [];

        if (active.length > 0) {
          setVertiports(active);
          setUsingMockData(false);
        } else {
          setVertiports(MOCK_VERTIPORTS);
          setUsingMockData(true);
        }
      })
      .catch(() => {
        if (alive) {
          setVertiports(MOCK_VERTIPORTS);
          setUsingMockData(true);
        }
      });

    return () => {
      alive = false;
    };
  }, [filters]);

  const filteredVertiports = useMemo(() => {
    if (!usingMockData) return vertiports;

    return vertiports.filter((vp) => {
      if (vp.distanceFromCenter > filters.maxDistance) return false;
      if (vp.pricePerKm > filters.maxPrice) return false;
      if (vp.suitabilityScore < filters.minScore) return false;
      if (filters.metro && !vp.features.includes('metro')) return false;
      if (filters.low_noise && !vp.features.includes('low_noise')) return false;
      if (filters.parking && !vp.features.includes('parking')) return false;
      if (filters.ev_charging && !vp.features.includes('ev_charging')) return false;
      return true;
    });
  }, [filters, vertiports, usingMockData]);

  const handleModeChange = (_, newMode) => {
    setActiveMode(newMode);
    if (newMode !== 'route') setRoute(null);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', bgcolor: '#020617' }}>
      <Navbar />

      <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <PassengerMapView
          filteredVertiports={filteredVertiports}
          selectedVertiport={selectedVertiport}
          route={activeMode === 'route' ? route : null}
          onVertiportSelect={setSelectedVertiport}
          flyToTarget={flyToTarget}
        />

        {usingMockData && (
          <Chip
            icon={<WifiOffIcon sx={{ fontSize: 14 }} />}
            label="Demo Mode - Live data unavailable"
            size="small"
            sx={{
              position: 'absolute',
              bottom: 16,
              right: 16,
              zIndex: 30,
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              color: '#f59e0b',
              fontSize: '0.68rem',
              backdropFilter: 'blur(8px)',
            }}
          />
        )}

        <Paper
          sx={{
            position: 'absolute',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
            background: 'rgba(2, 6, 23, 0.92)',
            backdropFilter: 'blur(14px)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '14px',
            overflow: 'hidden',
          }}
        >
          <Tabs
            value={activeMode}
            onChange={handleModeChange}
            sx={{
              minHeight: 42,
              '& .MuiTabs-indicator': { background: 'linear-gradient(90deg, #e17b8f, #e17b8f)', height: 2 },
              '& .MuiTab-root': {
                minHeight: 42,
                py: 0,
                px: 2.5,
                color: '#475569',
                fontFamily: 'Inter',
                fontWeight: 600,
                fontSize: '0.78rem',
                textTransform: 'none',
                letterSpacing: 0,
                gap: 0.8,
                '&.Mui-selected': { color: '#e2e8f0' },
              },
            }}
          >
            <Tab icon={<MapIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Map" value="map" />
            <Tab icon={<FlightIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Route" value="route" />
            <Tab
              icon={<StarIcon sx={{ fontSize: 16, color: favorites.length > 0 ? '#f59e0b' : 'inherit' }} />}
              iconPosition="start"
              label={(
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                  Favorites
                  {favorites.length > 0 && (
                    <Chip
                      label={favorites.length}
                      size="small"
                      sx={{
                        height: 16,
                        fontSize: '0.6rem',
                        minWidth: 20,
                        background: 'rgba(245,158,11,0.2)',
                        color: '#f59e0b',
                        border: 'none',
                      }}
                    />
                  )}
                </Box>
              )}
              value="favorites"
            />
            <Tab icon={<HistoryIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Past Flights" value="history" />
          </Tabs>
        </Paper>

        <Fade in={activeMode === 'map'}>
          <Box sx={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: activeMode === 'map' ? 'auto' : 'none' }}>
            <FilterSidebar
              filters={filters}
              onChange={setFilters}
              resultCount={filteredVertiports.length}
            />
          </Box>
        </Fade>

        <Fade in={activeMode === 'route'}>
          <Box sx={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none' }}>
            <Box sx={{ pointerEvents: 'auto', display: 'inline-block' }}>
              <RoutePlanner
                vertiports={vertiports}
                onRouteCalculated={setRoute}
                onClearRoute={() => setRoute(null)}
              />
            </Box>
          </Box>
        </Fade>

        <Fade in={activeMode === 'favorites'}>
          <Box sx={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none' }}>
            <Box sx={{ pointerEvents: 'auto', display: 'inline-block' }}>
              <FavoritesSidebar
                favorites={favorites}
                vertiports={vertiports}
                onToggle={toggleFavorite}
                onFlyTo={(vp) => setFlyToTarget(vp)}
              />
            </Box>
          </Box>
        </Fade>

        <Fade in={activeMode === 'history'}>
          <Box sx={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none' }}>
            <Box sx={{ pointerEvents: 'auto', display: 'inline-block' }}>
              <PastFlightsSidebar />
            </Box>
          </Box>
        </Fade>

        <Fade in={!!selectedVertiport}>
          <Box
            sx={{
              position: 'absolute',
              bottom: 56,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 20,
              pointerEvents: selectedVertiport ? 'auto' : 'none',
            }}
          >
            {selectedVertiport && (
              <VertiportDetailCard
                vp={selectedVertiport}
                isFavorite={favorites.includes(selectedVertiport.id)}
                onToggleFavorite={() => toggleFavorite(selectedVertiport.id)}
                onClose={() => setSelectedVertiport(null)}
              />
            )}
          </Box>
        </Fade>
      </Box>
    </Box>
  );
};

const VertiportDetailCard = ({ vp, isFavorite, onToggleFavorite, onClose }) => (
  <Paper
    sx={{
      background: 'rgba(2, 6, 23, 0.95)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '16px',
      boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
      p: 2,
      minWidth: 340,
      maxWidth: 420,
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: '12px',
          flexShrink: 0,
          background: `${scoreColor(vp.suitabilityScore)}18`,
          border: `1.5px solid ${scoreColor(vp.suitabilityScore)}44`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: scoreColor(vp.suitabilityScore), lineHeight: 1 }}>
          {vp.suitabilityScore}
        </Typography>
        <Typography sx={{ fontSize: '0.55rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          score
        </Typography>
      </Box>

      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontWeight: 700, color: '#e2e8f0', fontSize: '0.9rem', lineHeight: 1.3, mb: 0.3 }}>
          {vp.name}
        </Typography>
        <Typography sx={{ fontSize: '0.72rem', color: '#64748b' }}>
          {vp.distanceFromCenter} km from center - TL {vp.pricePerKm}/km
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
        <Tooltip title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
          <IconButton onClick={onToggleFavorite} size="small" sx={{ color: isFavorite ? '#f59e0b' : '#475569', '&:hover': { color: '#f59e0b' } }}>
            {isFavorite ? <StarIcon sx={{ fontSize: 18 }} /> : <StarBorderIcon sx={{ fontSize: 18 }} />}
          </IconButton>
        </Tooltip>
        <IconButton onClick={onClose} size="small" sx={{ color: '#475569', '&:hover': { color: '#e2e8f0' } }}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
    </Box>

    <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 1.5, lineHeight: 1.6 }}>
      {vp.description}
    </Typography>

    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, mt: 1.5 }}>
      {vp.features.map((f) => (
        <Chip
          key={f}
          label={`${FEATURE_ICONS[f]} ${FEATURE_LABELS[f]}`}
          size="small"
          sx={{
            height: 22,
            fontSize: '0.68rem',
            fontFamily: 'Inter',
            background: 'rgba(225,123,143,0.1)',
            border: '1px solid rgba(225,123,143,0.2)',
            color: '#60a5fa',
          }}
        />
      ))}
    </Box>
  </Paper>
);

const PastFlightsSidebar = () => {
  const flightHistory = useMemo(
    () => JSON.parse(localStorage.getItem('skyport_flight_history') || '[]'),
    []
  );

  return (
    <Paper
      sx={{
        position: 'absolute',
        top: '50%',
        left: 24,
        transform: 'translateY(-50%)',
        width: 320,
        background: 'rgba(2, 6, 23, 0.92)',
        backdropFilter: 'blur(14px)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '14px',
        maxHeight: 'calc(100vh - 180px)',
        overflowY: 'auto',
      }}
    >
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 1 }}>
        <HistoryIcon sx={{ fontSize: 16, color: '#e17b8f' }} />
        <Typography sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Past Flights
        </Typography>
      </Box>
      <Box sx={{ p: 2 }}>
        {flightHistory.length === 0 ? (
          <Typography sx={{ fontSize: '0.78rem', color: '#475569', textAlign: 'center', mt: 3 }}>No flights yet.</Typography>
        ) : flightHistory.map((flight, index) => (
          <Box key={index} sx={{ mb: 1.2, p: 1.5, borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#e17b8f' }}>{flight.flightNo}</Typography>
              <Typography sx={{ fontSize: '0.65rem', color: '#475569' }}>Gate {flight.gate}</Typography>
            </Box>
            <Typography sx={{ fontSize: '0.72rem', color: '#e2e8f0', fontWeight: 600 }} noWrap>
              {flight.from} to {flight.to}
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: '#64748b', mt: 0.3 }}>
              {flight.distance_km} km - {flight.duration_min} min - TL {flight.price_tl}
            </Typography>
            <Typography sx={{ fontSize: '0.6rem', color: '#334155', mt: 0.2 }}>{flight.date}</Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
};

export default PassengerPage;
