import React, { useEffect, useMemo, useState } from 'react';
import {
  Backdrop,
  Box,
  Button,
  Chip,
  Fade,
  IconButton,
  Modal,
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
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
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
  maxPrice: 5000,
  metro: false,
  low_noise: false,
  parking: false,
  ev_charging: false,
};

const CENTER = { lat: 41.0369, lng: 28.985 };
const MOCK_REVIEW_STORAGE_KEY = 'skyport_mock_vertiport_reviews';
const REVIEW_QUESTIONS = [
  { key: 'satisfaction_rating', label: 'Memnuniyet Orani' },
  { key: 'comfort_rating', label: 'Boarding Konforu' },
];

const buildEmptyReviewDraft = () => ({
  satisfaction_rating: 0,
  comfort_rating: 0,
});

const buildEmptyFlightReviewDraft = () => ({
  departure: buildEmptyReviewDraft(),
  arrival: buildEmptyReviewDraft(),
});

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

const estimateTripPrice = (distanceFromCenter, pricePerKm = 120) =>
  Math.round(Number(distanceFromCenter || 0) * Number(pricePerKm || 120));

const calculateOverallRating = (review) => (
  Number(
    (
      (Number(review.satisfaction_rating || 0) +
        Number(review.comfort_rating || 0)) / 2
    ).toFixed(2)
  )
);

const isDbVertiportId = (id) => Number.isInteger(id);

const readMockReviews = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(MOCK_REVIEW_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeMockReviews = (reviews) => {
  localStorage.setItem(MOCK_REVIEW_STORAGE_KEY, JSON.stringify(reviews));
};

const getReviewKey = (flightNo, vertiportId) => `${flightNo}:${vertiportId}`;

const upsertMockReview = (review) => {
  const existing = readMockReviews().filter(
    (item) => !(item.flight_no === review.flight_no && String(item.vertiport_id) === String(review.vertiport_id))
  );
  const next = [review, ...existing].slice(0, 100);
  writeMockReviews(next);
  return next;
};

const buildReviewAggregateMap = (reviews) => {
  const aggregate = new Map();
  reviews.forEach((review) => {
    const key = String(review.vertiport_id);
    if (!aggregate.has(key)) {
      aggregate.set(key, { sum: 0, count: 0 });
    }
    const bucket = aggregate.get(key);
    bucket.sum += Number(review.overall_rating ?? calculateOverallRating(review) ?? 0);
    bucket.count += 1;
  });
  return new Map(
    Array.from(aggregate.entries()).map(([key, value]) => [
      key,
      {
        averageRating: Number((value.sum / value.count).toFixed(2)),
        reviewCount: value.count,
      },
    ])
  );
};

const applyReviewAggregateToVertiports = (items, reviews) => {
  const aggregateMap = buildReviewAggregateMap(reviews);
  return items.map((vertiport) => {
    const stats = aggregateMap.get(String(vertiport.id));
    return {
      ...vertiport,
      averageRating: stats?.averageRating ?? null,
      reviewCount: stats?.reviewCount ?? 0,
    };
  });
};

const parseFlightSchedule = (flight) => {
  if (!flight?.departure_date || !flight?.departure_time) return null;
  const parsed = new Date(`${flight.departure_date}T${flight.departure_time}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const LEGACY_FLIGHT_HISTORY_KEY = 'skyport_flight_history';
const buildFlightHistoryStorageKey = (user) => (
  user?.id ? `skyport_flight_history_user_${user.id}` : 'skyport_flight_history_guest'
);

const sidebarScrollSx = {
  scrollbarWidth: 'thin',
  scrollbarColor: 'rgba(148,163,184,0.58) rgba(15,23,42,0.34)',
  '&::-webkit-scrollbar': {
    width: 10,
    height: 10,
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

const normalizeDbVertiport = (vp) => {
  const distanceFromCenter = Number(
    (vp.distance_from_center_km ?? distanceKm(CENTER, { lat: Number(vp.lat), lng: Number(vp.lng) })).toFixed(1)
  );
  return {
    id: vp.id,
    name: vp.name,
    lat: Number(vp.lat),
    lng: Number(vp.lng),
    features: Array.isArray(vp.features) ? vp.features : [],
    suitabilityScore: Number(vp.suitability_score ?? 75),
    pricePerKm: 120,
    estimatedTripPrice: estimateTripPrice(distanceFromCenter, 120),
    description: vp.description || 'Active vertiport from the SkyPort operational network.',
    noiseLevel: vp.noise_level || null,
    distanceFromCenter,
    averageRating: vp.average_rating !== null && vp.average_rating !== undefined ? Number(vp.average_rating) : null,
    reviewCount: Number(vp.review_count || 0),
  };
};

const scoreColor = (score) => {
  if (score >= 85) return '#22c55e';
  if (score >= 70) return '#eab308';
  return '#ef4444';
};

const resolveFlightTarget = (preferredId, fallbackName, vertiports, role) => {
  if (preferredId !== undefined && preferredId !== null) {
    const byId = vertiports.find((vertiport) => String(vertiport.id) === String(preferredId));
    if (byId) {
      return { role, vertiportId: byId.id, name: byId.name };
    }
    return { role, vertiportId: preferredId, name: fallbackName || 'Unknown vertiport' };
  }
  const byName = vertiports.find((vertiport) => vertiport.name === fallbackName);
  if (!byName) return null;
  return { role, vertiportId: byName.id, name: byName.name };
};

const resolveFlightReviewTargets = (flight, vertiports) => {
  const targets = [
    resolveFlightTarget(flight?.from_vertiport_id, flight?.from, vertiports, 'departure'),
    resolveFlightTarget(flight?.to_vertiport_id, flight?.to, vertiports, 'arrival'),
  ].filter(Boolean);

  return targets.filter((target, index, items) => (
    items.findIndex((item) => String(item.vertiportId) === String(target.vertiportId) && item.role === target.role) === index
  ));
};

const PassengerPage = () => {
  const { user } = useAuth();
  const flightHistoryStorageKey = useMemo(() => buildFlightHistoryStorageKey(user), [user]);
  const [activeMode, setActiveMode] = useState('map');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [selectedVertiport, setSelectedVertiport] = useState(null);
  const [route, setRoute] = useState(null);
  const [flyToTarget, setFlyToTarget] = useState(null);
  const [vertiports, setVertiports] = useState(() => applyReviewAggregateToVertiports(MOCK_VERTIPORTS, readMockReviews()));
  const [usingMockData, setUsingMockData] = useState(false);
  const [liveDataUnavailable, setLiveDataUnavailable] = useState(false);
  const [reviewRefreshKey, setReviewRefreshKey] = useState(0);
  const [flightHistory, setFlightHistory] = useState([]);
  const [userFlightReviews, setUserFlightReviews] = useState({});
  const [reviewFlight, setReviewFlight] = useState(null);
  const [reviewDraft, setReviewDraft] = useState(buildEmptyFlightReviewDraft);
  const [reviewHover, setReviewHover] = useState({});
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [historyNow, setHistoryNow] = useState(() => Date.now());
  const [bookingRefreshKey, setBookingRefreshKey] = useState(0);
  const [cancellingFlightKey, setCancellingFlightKey] = useState('');

  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('skyport_favorites')) || [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      const scoped = JSON.parse(localStorage.getItem(flightHistoryStorageKey) || '[]');
      setFlightHistory(Array.isArray(scoped) ? scoped : []);
    } catch {
      setFlightHistory([]);
    }

    if (localStorage.getItem(LEGACY_FLIGHT_HISTORY_KEY)) {
      localStorage.removeItem(LEGACY_FLIGHT_HISTORY_KEY);
    }
  }, [flightHistoryStorageKey]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setHistoryNow(Date.now());
    }, 60000);
    return () => window.clearInterval(intervalId);
  }, []);

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

  useEffect(() => {
    let alive = true;
    const next = {};
    readMockReviews().forEach((review) => {
      next[getReviewKey(review.flight_no, review.vertiport_id)] = review;
    });

    axios.get('/api/vertiport-reviews/me')
      .then((response) => {
        if (!alive) return;
        const items = Array.isArray(response.data?.items) ? response.data.items : [];
        items.forEach((review) => {
          next[getReviewKey(review.flight_no, review.vertiport_id)] = review;
        });
        setUserFlightReviews(next);
      })
      .catch(() => {
        if (alive) {
          setUserFlightReviews(next);
        }
      });

    return () => {
      alive = false;
    };
  }, [user?.id, reviewRefreshKey]);

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

        setVertiports(active);
        setUsingMockData(false);
        setLiveDataUnavailable(false);
      })
      .catch(() => {
        if (alive) {
          setVertiports(applyReviewAggregateToVertiports(MOCK_VERTIPORTS, readMockReviews()));
          setUsingMockData(true);
          setLiveDataUnavailable(true);
        }
      });

    return () => {
      alive = false;
    };
  }, [filters, reviewRefreshKey]);

  useEffect(() => {
    if (!selectedVertiport) return;
    const nextSelected = vertiports.find((vertiport) => vertiport.id === selectedVertiport.id);
    if (nextSelected && nextSelected !== selectedVertiport) {
      setSelectedVertiport(nextSelected);
    }
  }, [selectedVertiport, vertiports]);

  const filteredVertiports = useMemo(() => (
    vertiports.filter((vp) => {
      const estimatedTripPrice = vp.estimatedTripPrice ?? estimateTripPrice(vp.distanceFromCenter, vp.pricePerKm);
      if (vp.distanceFromCenter > filters.maxDistance) return false;
      if (estimatedTripPrice > filters.maxPrice) return false;
      if (vp.suitabilityScore < filters.minScore) return false;
      if (filters.metro && !vp.features.includes('metro')) return false;
      if (filters.low_noise && !vp.features.includes('low_noise')) return false;
      if (filters.parking && !vp.features.includes('parking')) return false;
      if (filters.ev_charging && !vp.features.includes('ev_charging')) return false;
      return true;
    })
  ), [filters, vertiports]);

  const handleModeChange = (_, newMode) => {
    setActiveMode(newMode);
    if (newMode !== 'route') setRoute(null);
  };

  const handleFlightBooked = (entry) => {
    setFlightHistory((prev) => {
      const next = [entry, ...prev].slice(0, 20);
      localStorage.setItem(flightHistoryStorageKey, JSON.stringify(next));
      return next;
    });
    setBookingRefreshKey((prev) => prev + 1);
  };

  const handleClearFlightHistory = () => {
    setFlightHistory((prev) => {
      const next = prev.filter((flight) => {
        const schedule = parseFlightSchedule(flight);
        return schedule && schedule.getTime() > historyNow;
      });
      localStorage.setItem(flightHistoryStorageKey, JSON.stringify(next));
      return next;
    });
  };

  const handleCancelUpcomingFlight = async (flight) => {
    const flightKey = `${flight.flightNo}:${flight.departure_date}:${flight.departure_time}`;
    setCancellingFlightKey(flightKey);
    try {
      if (flight.booking_id) {
        try {
          await axios.delete(`/api/bookings/${flight.booking_id}`);
        } catch (err) {
          if (err.response?.status !== 404) {
            throw err;
          }
        }
      }
      setFlightHistory((prev) => {
        const next = prev.filter((item) => !(
          item.flightNo === flight.flightNo
          && item.departure_date === flight.departure_date
          && item.departure_time === flight.departure_time
        ));
        localStorage.setItem(flightHistoryStorageKey, JSON.stringify(next));
        return next;
      });
      setBookingRefreshKey((prev) => prev + 1);
    } finally {
      setCancellingFlightKey('');
    }
  };

  const upcomingFlights = useMemo(() => (
    flightHistory.filter((flight) => {
      const schedule = parseFlightSchedule(flight);
      return schedule && schedule.getTime() > historyNow;
    })
  ), [flightHistory, historyNow]);

  const pastFlights = useMemo(() => (
    flightHistory.filter((flight) => {
      const schedule = parseFlightSchedule(flight);
      return !schedule || schedule.getTime() <= historyNow;
    })
  ), [flightHistory, historyNow]);

  const handleOpenReview = (flight) => {
    const targets = resolveFlightReviewTargets(flight, vertiports);
    const departureTarget = targets.find((target) => target.role === 'departure');
    const arrivalTarget = targets.find((target) => target.role === 'arrival');
    setReviewFlight(flight);
    setReviewDraft({
      departure: departureTarget
        ? {
            satisfaction_rating: Number(userFlightReviews[getReviewKey(flight.flightNo, departureTarget.vertiportId)]?.satisfaction_rating || 0),
            comfort_rating: Number(userFlightReviews[getReviewKey(flight.flightNo, departureTarget.vertiportId)]?.comfort_rating || 0),
          }
        : buildEmptyReviewDraft(),
      arrival: arrivalTarget
        ? {
            satisfaction_rating: Number(userFlightReviews[getReviewKey(flight.flightNo, arrivalTarget.vertiportId)]?.satisfaction_rating || 0),
            comfort_rating: Number(userFlightReviews[getReviewKey(flight.flightNo, arrivalTarget.vertiportId)]?.comfort_rating || 0),
          }
        : buildEmptyReviewDraft(),
    });
    setReviewHover({});
    setReviewError('');
    setReviewModalOpen(true);
  };

  const handleCloseReview = () => {
    setReviewModalOpen(false);
    setReviewFlight(null);
    setReviewHover({});
    setReviewDraft(buildEmptyFlightReviewDraft());
    setReviewError('');
  };

  const handleSubmitReview = async () => {
    if (!reviewFlight) return;
    const targets = resolveFlightReviewTargets(reviewFlight, vertiports);
    if (!targets.length) {
      setReviewError('This flight cannot be matched to a vertiport for rating.');
      return;
    }
    const missingSection = targets.find((target) => (
      REVIEW_QUESTIONS.some((question) => !reviewDraft[target.role]?.[question.key])
    ));
    if (missingSection) {
      setReviewError('Please rate both questions for departure and arrival before saving.');
      return;
    }

    setReviewSubmitting(true);
    setReviewError('');
    try {
      if (!usingMockData && targets.every((target) => isDbVertiportId(target.vertiportId))) {
        await Promise.all(targets.map((target) => axios.post('/api/vertiport-reviews', {
          vertiport_id: target.vertiportId,
          flight_no: reviewFlight.flightNo,
          satisfaction_rating: reviewDraft[target.role].satisfaction_rating,
          comfort_rating: reviewDraft[target.role].comfort_rating,
        })));
        setReviewRefreshKey((prev) => prev + 1);
      } else {
        let nextMockReviews = readMockReviews();
        const nextUserReviews = { ...userFlightReviews };
        targets.forEach((target) => {
          const reviewKey = getReviewKey(reviewFlight.flightNo, target.vertiportId);
          const existing = userFlightReviews[reviewKey];
          const localReview = {
            id: existing?.id || `local-${reviewFlight.flightNo}-${target.vertiportId}`,
            user_id: user?.id ?? null,
            vertiport_id: target.vertiportId,
            flight_no: reviewFlight.flightNo,
            satisfaction_rating: reviewDraft[target.role].satisfaction_rating,
            comfort_rating: reviewDraft[target.role].comfort_rating,
            overall_rating: calculateOverallRating(reviewDraft[target.role]),
            created_at: existing?.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          nextMockReviews = upsertMockReview(localReview);
          nextUserReviews[reviewKey] = localReview;
        });
        setUserFlightReviews(nextUserReviews);
        setVertiports(applyReviewAggregateToVertiports(MOCK_VERTIPORTS, nextMockReviews));
      }
      handleCloseReview();
    } catch (error) {
      setReviewError(error.response?.data?.message || error.response?.data?.detail || error.message);
    } finally {
      setReviewSubmitting(false);
    }
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

        {liveDataUnavailable && (
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
            <Tab icon={<HistoryIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Flights" value="history" />
          </Tabs>
        </Paper>

        <Fade in={activeMode === 'map'}>
          <Box sx={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none' }}>
            <Box sx={{ pointerEvents: activeMode === 'map' ? 'auto' : 'none', display: 'inline-block' }}>
              <FilterSidebar
                filters={filters}
                onChange={setFilters}
                resultCount={filteredVertiports.length}
              />
            </Box>
          </Box>
        </Fade>

        <Fade in={activeMode === 'route'}>
          <Box sx={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none' }}>
            <Box sx={{ pointerEvents: 'auto', display: 'inline-block' }}>
              <RoutePlanner
                vertiports={vertiports}
                onRouteCalculated={setRoute}
                onClearRoute={() => setRoute(null)}
                onFlightBooked={handleFlightBooked}
                bookingRefreshKey={bookingRefreshKey}
                historyStorageKey={flightHistoryStorageKey}
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
              <PastFlightsSidebar
                upcomingFlights={upcomingFlights}
                pastFlights={pastFlights}
                onClear={handleClearFlightHistory}
                onCancelUpcoming={handleCancelUpcomingFlight}
                cancellingFlightKey={cancellingFlightKey}
                onReview={handleOpenReview}
                reviewedFlights={userFlightReviews}
                vertiports={vertiports}
              />
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

        <ReviewFlightModal
          open={reviewModalOpen}
          flight={reviewFlight}
          vertiports={vertiports}
          draft={reviewDraft}
          hover={reviewHover}
          onClose={handleCloseReview}
          onChange={(role, key, value) => setReviewDraft((prev) => ({ ...prev, [role]: { ...prev[role], [key]: value } }))}
          onHoverChange={(role, key, value) => setReviewHover((prev) => ({ ...prev, [role]: { ...(prev[role] || {}), [key]: value } }))}
          onSubmit={handleSubmitReview}
          error={reviewError}
          submitting={reviewSubmitting}
        />
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
          {vp.distanceFromCenter} km from center - TL {vp.pricePerKm}/km - Est. TL {vp.estimatedTripPrice}
        </Typography>
        <ReviewSummary averageRating={vp.averageRating} reviewCount={vp.reviewCount} />
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

const PastFlightsSidebar = ({ upcomingFlights, pastFlights, onClear, onCancelUpcoming, cancellingFlightKey, onReview, reviewedFlights, vertiports }) => (
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
      overflowX: 'hidden',
      overflowY: 'auto',
      ...sidebarScrollSx,
    }}
  >
    <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 1 }}>
      <HistoryIcon sx={{ fontSize: 16, color: '#e17b8f' }} />
      <Typography sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        Flight History
      </Typography>
      {pastFlights.length > 0 && (
        <IconButton
          size="small"
          onClick={onClear}
          sx={{ ml: 'auto', color: '#475569', '&:hover': { color: '#f87171' } }}
        >
          <DeleteSweepIcon sx={{ fontSize: 17 }} />
        </IconButton>
      )}
    </Box>
    <Box sx={{ p: 2 }}>
      {!!upcomingFlights.length && (
        <Box sx={{ mb: pastFlights.length ? 2.2 : 0 }}>
          <Typography sx={{ fontSize: '0.64rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.8 }}>
            Upcoming Flights
          </Typography>
          {upcomingFlights.map((flight) => {
            const schedule = parseFlightSchedule(flight);
            const flightKey = `${flight.flightNo}:${flight.departure_date}:${flight.departure_time}`;
            return (
              <Box key={`upcoming-${flight.flightNo}`} sx={{ mb: 1.2, p: 1.5, borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#60a5fa' }}>{flight.flightNo}</Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: '#475569' }}>Gate {flight.gate}</Typography>
                </Box>
                <Typography sx={{ fontSize: '0.72rem', color: '#e2e8f0', fontWeight: 600 }} noWrap>
                  {flight.from} to {flight.to}
                </Typography>
                <Typography sx={{ fontSize: '0.65rem', color: '#64748b', mt: 0.3 }}>
                  {flight.distance_km} km - {flight.duration_min} min - TL {flight.price_tl}
                </Typography>
                <Typography sx={{ fontSize: '0.64rem', color: '#cbd5e1', mt: 0.5 }}>
                  Scheduled: {schedule ? schedule.toLocaleString() : `${flight.departure_date} ${flight.departure_time}`}
                </Typography>
                <Typography sx={{ fontSize: '0.62rem', color: '#475569', mt: 0.7 }}>
                  This booking will move to past flights after its departure time.
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                  <Button
                    size="small"
                    onClick={() => onCancelUpcoming(flight)}
                    disabled={cancellingFlightKey === flightKey}
                    sx={{ color: '#fca5a5', background: 'rgba(127,29,29,0.16)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '8px', textTransform: 'none', px: 1.4 }}
                  >
                    {cancellingFlightKey === flightKey ? 'Cancelling...' : 'Cancel'}
                  </Button>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {!!pastFlights.length && (
        <Typography sx={{ fontSize: '0.64rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.8 }}>
          Past Flights
        </Typography>
      )}

      {upcomingFlights.length === 0 && pastFlights.length === 0 ? (
        <Typography sx={{ fontSize: '0.78rem', color: '#475569', textAlign: 'center', mt: 3 }}>No flights yet.</Typography>
      ) : pastFlights.map((flight, index) => {
        const targets = resolveFlightReviewTargets(flight, vertiports);
        const canReview = targets.length > 0;
        const departureTarget = targets.find((target) => target.role === 'departure');
        const arrivalTarget = targets.find((target) => target.role === 'arrival');
        const departureReview = departureTarget ? reviewedFlights[getReviewKey(flight.flightNo, departureTarget.vertiportId)] : null;
        const arrivalReview = arrivalTarget ? reviewedFlights[getReviewKey(flight.flightNo, arrivalTarget.vertiportId)] : null;
        const hasSavedReview = Boolean(departureReview || arrivalReview);
        return (
          <Box key={`past-${flight.flightNo}-${index}`} sx={{ mb: 1.2, p: 1.5, borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
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

            <Box sx={{ mt: 1.2, pt: 1.1, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <Typography sx={{ fontSize: '0.64rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.7 }}>
                Degerlendir
              </Typography>
              {hasSavedReview ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.45 }}>
                  {departureTarget && (
                    <FlightReviewStatusRow
                      label="Departure"
                      vertiportName={departureTarget.name}
                      review={departureReview}
                    />
                  )}
                  {arrivalTarget && (
                    <FlightReviewStatusRow
                      label="Arrival"
                      vertiportName={arrivalTarget.name}
                      review={arrivalReview}
                    />
                  )}
                  <Typography sx={{ fontSize: '0.62rem', color: '#475569', mt: 0.2 }}>
                    Review already submitted. It cannot be edited.
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                  <Typography sx={{ fontSize: '0.66rem', color: canReview ? '#64748b' : '#fca5a5', lineHeight: 1.5 }}>
                    {canReview ? 'Share your experience for this flight.' : 'Legacy flight cannot be matched to a review target.'}
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => onReview(flight)}
                    disabled={!canReview}
                    sx={{ color: '#f8fafc', background: 'linear-gradient(135deg, #e17b8f, #be123c)', borderRadius: '8px', textTransform: 'none', px: 1.3, '&.Mui-disabled': { color: '#64748b', background: 'rgba(255,255,255,0.06)' } }}
                  >
                    Evaluate
                  </Button>
                </Box>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  </Paper>
);

const ReviewFlightModal = ({
  open,
  flight,
  vertiports,
  draft,
  hover,
  onClose,
  onChange,
  onHoverChange,
  onSubmit,
  error,
  submitting,
}) => {
  const targets = resolveFlightReviewTargets(flight, vertiports);

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeAfterTransition
      BackdropComponent={Backdrop}
      BackdropProps={{ timeout: 250, sx: { backdropFilter: 'blur(6px)', background: 'rgba(2,6,23,0.72)' } }}
    >
      <Fade in={open}>
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 'min(92vw, 540px)', outline: 'none' }}>
          <Paper sx={{ background: 'rgba(2, 6, 23, 0.96)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', boxShadow: '0 32px 80px rgba(0,0,0,0.52)', overflow: 'hidden' }}>
            <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '1rem' }}>
                  Flight Review
                </Typography>
                <Typography sx={{ color: '#94a3b8', fontSize: '0.72rem', mt: 0.4, lineHeight: 1.5 }}>
                  {flight ? `${flight.from} to ${flight.to} - ${flight.flightNo}` : 'Rate your recent flight experience'}
                </Typography>
              </Box>
              <IconButton onClick={onClose} size="small" sx={{ color: '#64748b', '&:hover': { color: '#e2e8f0' } }}>
                <CloseIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>

            <Box sx={{ p: 2.5 }}>
              {targets.map((target, index) => (
                <Box key={`${target.role}-${target.vertiportId}`} sx={{ mb: index === targets.length - 1 ? 0 : 2.5, p: 1.6, borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <Typography sx={{ color: '#f8fafc', fontSize: '0.84rem', fontWeight: 800 }}>
                    {target.role === 'departure' ? 'Departure Vertiport' : 'Arrival Vertiport'}
                  </Typography>
                  <Typography sx={{ color: '#94a3b8', fontSize: '0.7rem', mt: 0.35, mb: 1.2 }}>
                    {target.name}
                  </Typography>

                  {REVIEW_QUESTIONS.map((question) => (
                    <Box key={`${target.role}-${question.key}`} sx={{ mb: 1.8 }}>
                      <Typography sx={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 700 }}>
                        {question.label}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.2, mt: 0.6 }}>
                        {[1, 2, 3, 4, 5].map((value) => {
                          const activeValue = hover[target.role]?.[question.key] || draft[target.role]?.[question.key];
                          return (
                            <IconButton
                              key={`${target.role}-${question.key}-${value}`}
                              onClick={() => onChange(target.role, question.key, value)}
                              onMouseEnter={() => onHoverChange(target.role, question.key, value)}
                              onMouseLeave={() => onHoverChange(target.role, question.key, 0)}
                              sx={{ p: 0.25, color: value <= activeValue ? '#f59e0b' : '#334155', transition: 'transform 0.12s ease, color 0.12s ease', '&:hover': { transform: 'translateY(-1px)' } }}
                            >
                              {value <= activeValue ? <StarIcon sx={{ fontSize: 28 }} /> : <StarBorderIcon sx={{ fontSize: 28 }} />}
                            </IconButton>
                          );
                        })}
                        <Typography sx={{ color: '#94a3b8', fontSize: '0.72rem', ml: 0.8 }}>
                          {(hover[target.role]?.[question.key] || draft[target.role]?.[question.key] || 0)}/5
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              ))}

              {error && (
                <Typography sx={{ color: '#fca5a5', fontSize: '0.72rem', lineHeight: 1.5, mt: 1.2 }}>
                  {error}
                </Typography>
              )}

              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.2, mt: 2.5 }}>
                <Button
                  onClick={onClose}
                  sx={{ color: '#94a3b8', borderRadius: '10px', textTransform: 'none', px: 1.6 }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={onSubmit}
                  disabled={submitting}
                  sx={{ color: '#fff', background: 'linear-gradient(135deg, #e17b8f, #be123c)', borderRadius: '10px', textTransform: 'none', fontWeight: 700, px: 2.2, '&.Mui-disabled': { color: '#cbd5e1', background: 'rgba(255,255,255,0.12)' } }}
                >
                  {submitting ? 'Saving...' : 'Save Review'}
                </Button>
              </Box>
            </Box>
          </Paper>
        </Box>
      </Fade>
    </Modal>
  );
};

const ReviewSummary = ({ averageRating, reviewCount }) => {
  if (!reviewCount || !averageRating) {
    return (
      <Typography sx={{ fontSize: '0.66rem', color: '#475569', mt: 0.7 }}>
        No passenger ratings yet
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mt: 0.7, flexWrap: 'wrap' }}>
      <StaticStarRating averageRating={averageRating} size={16} />
      <Typography sx={{ fontSize: '0.68rem', color: '#f8fafc', fontWeight: 700 }}>
        {Number(averageRating).toFixed(1)}
      </Typography>
      <Typography sx={{ fontSize: '0.66rem', color: '#64748b' }}>
        {reviewCount} passenger review{reviewCount === 1 ? '' : 's'}
      </Typography>
    </Box>
  );
};

const FlightReviewStatusRow = ({ label, vertiportName, review }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, flexWrap: 'wrap' }}>
    <Typography sx={{ fontSize: '0.62rem', color: '#94a3b8', fontWeight: 700, minWidth: 54 }}>
      {label}
    </Typography>
    <Typography sx={{ fontSize: '0.64rem', color: '#64748b', maxWidth: 118 }} noWrap>
      {vertiportName}
    </Typography>
    {review ? (
      <>
        <StaticStarRating averageRating={review.overall_rating} size={14} />
        <Typography sx={{ fontSize: '0.62rem', color: '#e2e8f0' }}>
          {Number(review.overall_rating).toFixed(1)}/5
        </Typography>
      </>
    ) : (
      <Typography sx={{ fontSize: '0.62rem', color: '#475569' }}>
        Not rated
      </Typography>
    )}
  </Box>
);

const StaticStarRating = ({ averageRating = 0, size = 18 }) => {
  const width = Math.max(0, Math.min((Number(averageRating || 0) / 5) * 100, 100));

  return (
    <Box sx={{ position: 'relative', width: size * 5, height: size, display: 'inline-flex' }}>
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', color: '#334155' }}>
        {[0, 1, 2, 3, 4].map((item) => (
          <StarIcon key={`star-bg-${item}`} sx={{ fontSize: size }} />
        ))}
      </Box>
      <Box sx={{ position: 'absolute', inset: 0, width: `${width}%`, overflow: 'hidden', display: 'flex', color: '#f59e0b' }}>
        {[0, 1, 2, 3, 4].map((item) => (
          <StarIcon key={`star-fill-${item}`} sx={{ fontSize: size }} />
        ))}
      </Box>
    </Box>
  );
};

export default PassengerPage;
