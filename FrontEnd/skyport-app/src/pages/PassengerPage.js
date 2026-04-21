import React, { useEffect, useState, useMemo } from 'react';
import {
  Box, Paper, Typography, IconButton, Tooltip,
  Tabs, Tab, Fade, Chip,
} from '@mui/material';
import MapIcon from '@mui/icons-material/Map';
import FlightIcon from '@mui/icons-material/Flight';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import CloseIcon from '@mui/icons-material/Close';
import axios from 'axios';

import Navbar from '../components/Navbar';
import PassengerMapView from '../components/passenger/PassengerMapView';
import FilterSidebar from '../components/passenger/FilterSidebar';
import FavoritesSidebar from '../components/passenger/FavoritesSidebar';
import RoutePlanner from '../components/passenger/RoutePlanner';
import { MOCK_VERTIPORTS, FEATURE_ICONS, FEATURE_LABELS } from '../mock/vertiports';

const DEFAULT_FILTERS = {
  maxDistance: 40,
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

const normalizeDbVertiport = (vp) => ({
  id: vp.id,
  name: vp.name,
  lat: Number(vp.lat),
  lng: Number(vp.lng),
  features: [],
  suitabilityScore: Number(vp.suitability_score ?? 75),
  pricePerKm: Number(vp.price_per_km ?? 3.5),
  description: vp.description || 'Active vertiport from the SkyPort operational network.',
  distanceFromCenter: Number(distanceKm(CENTER, { lat: Number(vp.lat), lng: Number(vp.lng) }).toFixed(1)),
});

const scoreColor = (score) => {
  if (score >= 85) return '#22c55e';
  if (score >= 70) return '#eab308';
  return '#ef4444';
};

const PassengerPage = () => {
  const [activeMode, setActiveMode] = useState('map'); // 'map' | 'route' | 'favorites'
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [selectedVertiport, setSelectedVertiport] = useState(null);
  const [route, setRoute] = useState(null);
  const [flyToTarget, setFlyToTarget] = useState(null);
  const [vertiports, setVertiports] = useState(MOCK_VERTIPORTS);

  // Favorites stored in localStorage
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('skyport_favorites')) || []; }
    catch { return []; }
  });

  const toggleFavorite = (id) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id];
      localStorage.setItem('skyport_favorites', JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    let alive = true;
    axios.get('/api/vertiports')
      .then((response) => {
        if (!alive) return;
        const active = Array.isArray(response.data) ? response.data.map(normalizeDbVertiport) : [];
        if (active.length > 0) {
          setVertiports(active);
        }
      })
      .catch(() => {
        if (alive) setVertiports(MOCK_VERTIPORTS);
      });
    return () => { alive = false; };
  }, []);

  // Apply filters to vertiport list
  const filteredVertiports = useMemo(() => {
    return vertiports.filter((vp) => {
      if (vp.distanceFromCenter > filters.maxDistance) return false;
      if (filters.metro && !vp.features.includes('metro')) return false;
      if (filters.low_noise && !vp.features.includes('low_noise')) return false;
      if (filters.parking && !vp.features.includes('parking')) return false;
      if (filters.ev_charging && !vp.features.includes('ev_charging')) return false;
      return true;
    });
  }, [filters, vertiports]);

  const handleModeChange = (_, newMode) => {
    setActiveMode(newMode);
    if (newMode !== 'route') { setRoute(null); }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', bgcolor: '#0a0f1a' }}>
      <Navbar />

      {/* Map + floating panels */}
      <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

        {/* Map fills entire background */}
        <PassengerMapView
          filteredVertiports={filteredVertiports}
          selectedVertiport={selectedVertiport}
          route={activeMode === 'route' ? route : null}
          onVertiportSelect={setSelectedVertiport}
          flyToTarget={flyToTarget}
        />

        {/* ── Mode Tab Bar — floating top center ── */}
        <Paper
          sx={{
            position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
            zIndex: 20,
            background: 'rgba(10, 18, 35, 0.92)',
            backdropFilter: 'blur(14px)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          <Tabs
            value={activeMode}
            onChange={handleModeChange}
            sx={{
              minHeight: 42,
              '& .MuiTabs-indicator': { background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)', height: 2 },
              '& .MuiTab-root': {
                minHeight: 42, py: 0, px: 2.5,
                color: '#475569', fontFamily: 'Inter', fontWeight: 600,
                fontSize: '0.78rem', textTransform: 'none', letterSpacing: 0,
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
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                  Favorites
                  {favorites.length > 0 && (
                    <Chip label={favorites.length} size="small" sx={{
                      height: 16, fontSize: '0.6rem', minWidth: 20,
                      background: 'rgba(245,158,11,0.2)', color: '#f59e0b', border: 'none',
                    }} />
                  )}
                </Box>
              }
              value="favorites"
            />
          </Tabs>
        </Paper>

        {/* ── Filter Sidebar — shown in Map mode ── */}
        <Fade in={activeMode === 'map'}>
          <Box sx={{ position: 'absolute', top: 0, left: 0, zIndex: 10, pointerEvents: activeMode === 'map' ? 'auto' : 'none' }}>
            <FilterSidebar
              filters={filters}
              onChange={setFilters}
              resultCount={filteredVertiports.length}
            />
          </Box>
        </Fade>

        {/* ── Route Planner — shown in Route mode ── */}
        <Fade in={activeMode === 'route'}>
          <Box sx={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none' }}>
            <RoutePlanner
              vertiports={vertiports}
              onRouteCalculated={setRoute}
              onClearRoute={() => setRoute(null)}
            />
          </Box>
        </Fade>

        {/* ── Favorites Sidebar — shown in Favorites mode ── */}
        <Fade in={activeMode === 'favorites'}>
          <Box sx={{ position: 'absolute', top: 0, right: 0, zIndex: 10, pointerEvents: activeMode === 'favorites' ? 'auto' : 'none' }}>
            <FavoritesSidebar
              favorites={favorites}
              vertiports={vertiports}
              onToggle={toggleFavorite}
              onFlyTo={(vp) => setFlyToTarget(vp)}
            />
          </Box>
        </Fade>

        {/* ── Vertiport Detail Card — floating bottom center ── */}
        <Fade in={!!selectedVertiport}>
          <Box sx={{
            position: 'absolute', bottom: 56, left: '50%', transform: 'translateX(-50%)',
            zIndex: 20, pointerEvents: selectedVertiport ? 'auto' : 'none',
          }}>
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

// ─── Vertiport Detail Card ─────────────────────────────────────────────────────
const VertiportDetailCard = ({ vp, isFavorite, onToggleFavorite, onClose }) => (
  <Paper sx={{
    background: 'rgba(10, 18, 35, 0.95)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    p: 2,
    minWidth: 340,
    maxWidth: 420,
    boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
  }}>
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
      {/* Score */}
      <Box sx={{
        width: 48, height: 48, borderRadius: '12px', flexShrink: 0,
        background: `${scoreColor(vp.suitabilityScore)}18`,
        border: `1.5px solid ${scoreColor(vp.suitabilityScore)}44`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: scoreColor(vp.suitabilityScore), lineHeight: 1 }}>
          {vp.suitabilityScore}
        </Typography>
        <Typography sx={{ fontSize: '0.55rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          score
        </Typography>
      </Box>

      {/* Name & distance */}
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontWeight: 700, color: '#e2e8f0', fontSize: '0.9rem', lineHeight: 1.3, mb: 0.3 }}>
          {vp.name}
        </Typography>
        <Typography sx={{ fontSize: '0.72rem', color: '#64748b' }}>
          {vp.distanceFromCenter} km from center · ₺{vp.pricePerKm}/km
        </Typography>
      </Box>

      {/* Favorite + Close */}
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

    {/* Description */}
    <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 1.5, lineHeight: 1.6 }}>
      {vp.description}
    </Typography>

    {/* Features */}
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, mt: 1.5 }}>
      {vp.features.map((f) => (
        <Chip
          key={f}
          label={`${FEATURE_ICONS[f]} ${FEATURE_LABELS[f]}`}
          size="small"
          sx={{
            height: 22, fontSize: '0.68rem', fontFamily: 'Inter',
            background: 'rgba(59,130,246,0.1)',
            border: '1px solid rgba(59,130,246,0.2)',
            color: '#60a5fa',
          }}
        />
      ))}
    </Box>
  </Paper>
);

export default PassengerPage;
