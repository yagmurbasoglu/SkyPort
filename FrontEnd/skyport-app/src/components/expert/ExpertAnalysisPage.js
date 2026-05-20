import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Fade,
  IconButton,
  LinearProgress,
  Modal,
  Paper,
  Slider,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import AirIcon from '@mui/icons-material/Air';
import ApartmentIcon from '@mui/icons-material/Apartment';
import BusinessIcon from '@mui/icons-material/Business';
import CloseIcon from '@mui/icons-material/Close';
import CropFreeIcon from '@mui/icons-material/CropFree';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DescriptionIcon from '@mui/icons-material/Description';
import DownloadIcon from '@mui/icons-material/Download';
import DirectionsTransitIcon from '@mui/icons-material/DirectionsTransit';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import FmdGoodIcon from '@mui/icons-material/FmdGood';
import LightModeIcon from '@mui/icons-material/LightMode';
import LogoutIcon from '@mui/icons-material/Logout';
import MapIcon from '@mui/icons-material/Map';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import RouteIcon from '@mui/icons-material/AltRoute';
import SatelliteAltIcon from '@mui/icons-material/SatelliteAlt';
import ScienceIcon from '@mui/icons-material/Science';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import axios from 'axios';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useAuth } from '../../context/AuthContext';
import { getApiErrorMessage } from '../../utils/apiError';
import { getMapStyle, hasMapboxToken } from '../../utils/mapStyle';

const ISTANBUL_CENTER = [28.9784, 41.0082];
const ISTANBUL_ZOOM = 9.35;
const ISTANBUL_AIRSPACE_BOUNDS = {
  west: 28.45,
  east: 29.95,
  south: 40.75,
  north: 41.65,
};
const DEFAULT_WEIGHTS = {
  obstacle: 0.22,
  transport: 0.18,
  land_use: 0.14,
  nfz: 0.16,
  traffic_density: 0.16,
  socioeconomic: 0.14,
};
const criteriaLabels = {
  obstacle: 'Obstacle',
  transport: 'Transport',
  land_use: 'Land Use',
  nfz: 'NFZ',
  traffic_density: 'Traffic Density',
  socioeconomic: 'Socioeconomic',
};
const compareDescriptions = {
  total: 'Higher is better. This is the overall AHP/TOPSIS suitability score across all criteria.',
  obstacle: 'Higher is better. A high score means lower obstacle risk and cleaner approach paths.',
  transport: 'Higher is better. A high score means stronger road and transport connectivity around the cell.',
  land_use: 'Higher is better. A high score means the surrounding land use is more suitable for vertiport placement.',
  nfz: 'Higher is better. A high score means the cell is farther from NFZ-related risk. It does not mean the cell is inside an NFZ.',
  traffic_density: 'Higher is better. A high score means official IBB traffic density indicates stronger movement demand around the cell.',
  socioeconomic: 'Higher is better. A high score means official TUIK district population data indicates stronger demographic demand around the cell.',
};
const emptyCollection = { type: 'FeatureCollection', features: [] };
const EXPERT_ROUTE_WIND_LIMIT = 60;
const DEFAULT_EXPERT_ROUTE = {
  fromName: 'Taksim Central Vertiport',
  toName: 'Uskudar Ferry Vertiport',
  windLimitKmh: EXPERT_ROUTE_WIND_LIMIT,
};
const DEFAULT_ROUTE_POINTS = {
  from: { lat: 41.0369, lng: 28.985, name: 'Taksim Central Vertiport' },
  to: { lat: 41.022, lng: 29.0151, name: 'Uskudar Ferry Vertiport' },
};

const panelSx = {
  background: 'rgba(2, 6, 23, 0.92)',
  backdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '8px',
  boxShadow: '0 10px 32px rgba(0,0,0,0.35)',
};

const scrollPanelSx = {
  scrollbarWidth: 'thin',
  scrollbarColor: 'rgba(148,163,184,0.42) rgba(15,23,42,0.28)',
  '&::-webkit-scrollbar': {
    width: 7,
  },
  '&::-webkit-scrollbar-track': {
    background: 'rgba(15,23,42,0.28)',
    borderRadius: '8px',
  },
  '&::-webkit-scrollbar-thumb': {
    background: 'rgba(148,163,184,0.42)',
    borderRadius: '8px',
    border: '2px solid rgba(15,23,42,0.28)',
  },
  '&::-webkit-scrollbar-thumb:hover': {
    background: 'rgba(203,213,225,0.58)',
  },
};

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    color: '#e2e8f0',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '8px',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.24)' },
    '&.Mui-focused fieldset': { borderColor: '#b65f70' },
  },
  '& .MuiInputLabel-root': { color: '#cbd5e1' },
  '& .MuiInputBase-input': { color: '#f8fafc' },
  '& .MuiInputBase-input::-webkit-calendar-picker-indicator': {
    filter: 'invert(1) brightness(1.35)',
    opacity: 0.92,
    cursor: 'pointer',
  },
  '& .MuiSvgIcon-root': { color: '#cbd5e1' },
  '& .MuiSelect-icon': { color: '#cbd5e1' },
};

const statusColor = (status) => {
  if (status === 'completed' || status === 'success') return '#22c55e';
  if (status === 'partial_success' || status === 'running') return '#f59e0b';
  if (status === 'failed' || status === 'blocked' || status === 'unsafe' || status === 'weather_risk') return '#ef4444';
  if (status === 'warning') return '#f97316';
  if (status === 'safe') return '#22c55e';
  return '#94a3b8';
};

const statusChipSx = (status) => {
  if (status === 'blocked' || status === 'unsafe' || status === 'failed' || status === 'weather_risk') {
    return {
      bgcolor: 'rgba(239,68,68,0.24)',
      color: '#fecaca',
      border: '1px solid rgba(248,113,113,0.6)',
      height: 24,
      fontWeight: 900,
      textTransform: 'uppercase',
    };
  }
  return {
    bgcolor: `${statusColor(status)}22`,
    color: statusColor(status),
    height: 22,
    fontWeight: 800,
  };
};

const scoreColor = (score) => {
  if (score >= 95) return '#16a34a';
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#f59e0b';
  if (score >= 30) return '#ef4444';
  return '#991b1b';
};

const scoreClassLabel = (scoreClass) => {
  if (scoreClass === 'best_fit') return 'Best Fit';
  if (scoreClass === 'strong') return 'Strong';
  if (scoreClass === 'moderate') return 'Moderate';
  if (scoreClass === 'low') return 'Low';
  if (scoreClass === 'unsuitable') return 'Unsuitable';
  return scoreClass || 'n/a';
};

const formatTimestamp = (value) => {
  if (!value) return 'Unknown time';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
};

const bboxToFeature = (bbox) => ({
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [bbox.west, bbox.south],
      [bbox.east, bbox.south],
      [bbox.east, bbox.north],
      [bbox.west, bbox.north],
      [bbox.west, bbox.south],
    ]],
  },
  properties: {},
});

const createAircraftElement = (blocked = false) => {
  const shell = document.createElement('div');
  shell.style.cssText = `
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    pointer-events: none;
    filter: drop-shadow(0 0 12px ${blocked ? 'rgba(239,68,68,0.95)' : 'rgba(182,95,112,0.95)'});
  `;
  shell.innerHTML = `
    <svg width="38" height="38" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="20" fill="${blocked ? 'rgba(239,68,68,0.22)' : 'rgba(182,95,112,0.22)'}" stroke="${blocked ? '#fca5a5' : '#e17b8f'}" stroke-width="2"/>
      <path d="M31 9 L39 31 L56 38 L55 44 L37 40 L32 55 L27 55 L27 40 L9 44 L8 38 L25 31 Z" fill="${blocked ? '#ef4444' : '#b65f70'}" stroke="#f8fafc" stroke-width="2" stroke-linejoin="round"/>
      <path d="M26 31 H38" stroke="#0f172a" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
    </svg>
  `;
  return shell;
};

const routePointAt = (coordinates, progress) => {
  if (!coordinates?.length) return null;
  const maxIndex = coordinates.length - 1;
  const exactIndex = Math.max(0, Math.min(maxIndex, progress * maxIndex));
  const low = Math.floor(exactIndex);
  const high = Math.min(maxIndex, low + 1);
  const local = exactIndex - low;
  const start = coordinates[low];
  const end = coordinates[high];
  return [
    start[0] + (end[0] - start[0]) * local,
    start[1] + (end[1] - start[1]) * local,
  ];
};

const routeStopProgress = (route) => {
  if (route?.stop_progress !== null && route?.stop_progress !== undefined) {
    return Math.max(0.04, Math.min(0.98, Number(route.stop_progress)));
  }
  const blocker = route?.conflicts?.find((conflict) => conflict.severity === 'blocker' && conflict.route_progress !== null && conflict.route_progress !== undefined);
  if (!blocker) return route?.is_safe === false ? 0.58 : 1;
  return Math.max(0.04, Math.min(0.98, Number(blocker.route_progress)));
};

const routeStopPoint = (route) => {
  if (Array.isArray(route?.stop_point)) return route.stop_point;
  const blocker = route?.conflicts?.find((conflict) => conflict.severity === 'blocker' && Array.isArray(conflict.block_point));
  return blocker?.block_point || null;
};

const routeLineColor = (route) => {
  if (route?.safety_status === 'safe') return '#22c55e';
  if (route?.safety_status === 'warning') return '#f59e0b';
  if (route?.safety_status === 'blocked' || route?.is_safe === false) return '#ef4444';
  return '#f97316';
};

const buildingCollection = (geojson) => {
  if (geojson?.type === 'FeatureCollection') return geojson;
  return emptyCollection;
};

const readCriteriaScores = (candidate) => {
  const scores = candidate?.criteria_breakdown?.criteria_scores;
  if (scores && typeof scores === 'object') return scores;
  if (typeof candidate?.criteria_scores === 'string') {
    try {
      return JSON.parse(candidate.criteria_scores);
    } catch {
      return {};
    }
  }
  if (candidate?.criteria_scores && typeof candidate.criteria_scores === 'object') {
    return candidate.criteria_scores;
  }
  return {};
};

const readFeatureCriteriaScores = (props) => {
  const breakdown = props?.criteria_breakdown;
  if (breakdown?.criteria_scores && typeof breakdown.criteria_scores === 'object') {
    return breakdown.criteria_scores;
  }
  if (typeof breakdown === 'string') {
    try {
      const parsed = JSON.parse(breakdown);
      return parsed?.criteria_scores && typeof parsed.criteria_scores === 'object' ? parsed.criteria_scores : {};
    } catch {
      return {};
    }
  }
  if (typeof props?.criteria_scores === 'string') {
    try {
      return JSON.parse(props.criteria_scores);
    } catch {
      return {};
    }
  }
  return {};
};

const readCriteriaBreakdown = (candidate) => {
  const breakdown = candidate?.criteria_breakdown;
  if (breakdown && typeof breakdown === 'object') return breakdown;
  if (typeof breakdown === 'string') {
    try {
      return JSON.parse(breakdown);
    } catch {
      return {};
    }
  }
  return {};
};

const readWeightedValues = (candidate) => {
  const weighted = readCriteriaBreakdown(candidate)?.weighted_values;
  return weighted && typeof weighted === 'object' ? weighted : {};
};

const readPriorityVector = (candidate, fallbackWeights = {}) => {
  const weights = readCriteriaBreakdown(candidate)?.priority_vector;
  return weights && typeof weights === 'object' ? weights : fallbackWeights;
};

const criterionImpactRows = (candidate, fallbackWeights = {}) => {
  const scores = readCriteriaScores(candidate);
  const weighted = readWeightedValues(candidate);
  const weights = readPriorityVector(candidate, fallbackWeights);
  return Object.keys(criteriaLabels).map((key) => ({
    key,
    score: Number(scores[key] || 0),
    weight: Number(weights[key] ?? fallbackWeights[key] ?? 0),
    impact: Number(weighted[key] ?? ((scores[key] || 0) * (weights[key] ?? fallbackWeights[key] ?? 0))),
  }));
};

const explainCriterionContext = (candidate, criterion) => {
  const context = readCriteriaBreakdown(candidate)?.criteria_context?.[criterion];
  if (!context || typeof context !== 'object') return null;
  if (criterion === 'nfz') {
    if (context.intersects_nfz) return 'This cell intersects an NFZ, so the final suitability is forced to 0.';
    if (context.min_distance_km !== undefined && context.min_distance_km !== null) {
      return `Nearest NFZ distance: ${Number(context.min_distance_km).toFixed(2)} km.`;
    }
  }
  if (criterion === 'obstacle' && context.obstacle_count !== undefined) {
    return `Obstacle signal count: ${context.obstacle_count}.`;
  }
  if (criterion === 'transport' && context.transport_score !== undefined) {
    return `Transport access index: ${Number(context.transport_score).toFixed(2)}.`;
  }
  if (criterion === 'land_use' && context.land_use_score !== undefined) {
    return `Land-use suitability index: ${Number(context.land_use_score).toFixed(2)}.`;
  }
  return null;
};

const compareCriterionValue = (candidate, criterion) => {
  if (criterion === 'total') return Math.round(candidate?.suitability_score || 0);
  return Math.round((readCriteriaScores(candidate)[criterion] || 0) * 100);
};

const shortCellIndex = (cellIndex) => {
  if (!cellIndex) return 'Unknown';
  if (cellIndex.length <= 12) return cellIndex;
  return `${cellIndex.slice(0, 6)}...${cellIndex.slice(-4)}`;
};

const compareCandidateLabel = (index) => {
  if (index === 0) return 'Best Option';
  if (index === 1) return 'Option 2';
  if (index === 2) return 'Option 3';
  return `Option ${index + 1}`;
};

const compareInsightText = (rankedCandidates, criterion) => {
  const baseText = compareDescriptions[criterion] || '';
  if (!Array.isArray(rankedCandidates) || rankedCandidates.length < 2) return baseText;
  const values = rankedCandidates.map((candidate) => compareCriterionValue(candidate, criterion));
  const allEqual = values.every((value) => value === values[0]);
  if (!allEqual) return baseText;
  if (criterion === 'total') return `${baseText} All compared candidates are currently tied overall.`;
  return `${baseText} All compared candidates are currently tied on this criterion.`;
};

const routeWeatherSafetyLimit = (routeResult) => {
  if (!routeResult) return `${EXPERT_ROUTE_WIND_LIMIT.toFixed(1)} km/h`;
  return `${EXPERT_ROUTE_WIND_LIMIT.toFixed(1)} km/h`;
};

const routeCriticalWeatherMetric = (routeResult) => {
  if (!routeResult?.weather) return 'n/a';
  const candidates = [
    ['10m wind', routeResult.weather.wind_kmh],
    ['Wind gust', routeResult.weather.wind_gusts_kmh],
    ['80m wind', routeResult.weather.wind_80m_kmh],
    ['120m wind', routeResult.weather.wind_120m_kmh],
  ].filter((item) => item[1] !== undefined && item[1] !== null);
  if (!candidates.length) return 'n/a';
  const [label, value] = candidates.reduce((best, current) => (
    Number(current[1]) > Number(best[1]) ? current : best
  ));
  return `${label} - ${Number(value).toFixed(1)} km/h`;
};

const applyRasterBasemapMode = (instance, mode) => {
  if (!instance?.getLayer('osm') || !instance?.getLayer('satellite')) return;
  const showSatellite = mode === 'satellite';
  instance.setLayoutProperty('osm', 'visibility', showSatellite ? 'none' : 'visible');
  instance.setLayoutProperty('satellite', 'visibility', showSatellite ? 'visible' : 'none');
  if (showSatellite) {
    instance.setPaintProperty('satellite', 'raster-opacity', 1);
    instance.setPaintProperty('satellite', 'raster-saturation', 0);
    instance.setPaintProperty('satellite', 'raster-contrast', 0);
    return;
  }
  if (mode === 'light') {
    instance.setPaintProperty('osm', 'raster-opacity', 1);
    instance.setPaintProperty('osm', 'raster-brightness-min', 0);
    instance.setPaintProperty('osm', 'raster-brightness-max', 1);
    instance.setPaintProperty('osm', 'raster-saturation', 0);
    instance.setPaintProperty('osm', 'raster-contrast', 0);
    return;
  }
  instance.setPaintProperty('osm', 'raster-opacity', 1);
  instance.setPaintProperty('osm', 'raster-brightness-min', 0.02);
  instance.setPaintProperty('osm', 'raster-brightness-max', 0.42);
  instance.setPaintProperty('osm', 'raster-saturation', -0.35);
  instance.setPaintProperty('osm', 'raster-contrast', 0.18);
};

const fitBoundsSafely = (instance, bounds, options = {}) => {
  if (!instance || !bounds || bounds.isEmpty()) return;
  const { padding = 72, duration = 900, maxZoom, pitch, bearing } = options;
  const baseOptions = { padding, duration };
  if (maxZoom !== undefined) baseOptions.maxZoom = maxZoom;

  try {
    if (hasMapboxToken()) {
      instance.fitBounds(bounds, {
        ...baseOptions,
        ...(pitch !== undefined ? { pitch } : {}),
        ...(bearing !== undefined ? { bearing } : {}),
      });
      return;
    }
    instance.fitBounds(bounds, baseOptions);
  } catch (_err) {
    try {
      instance.fitBounds(bounds, baseOptions);
    } catch (_innerErr) {
      // Keep the current view instead of crashing the expert page.
    }
  }
};

const readApiError = (error, fallback = 'Request failed.') => getApiErrorMessage(error, fallback);

const ExpertAnalysisPage = () => {
  const { logout, updateProfile, user } = useAuth();
  const mapContainer = useRef(null);
  const map = useRef(null);
  const drawOverlay = useRef(null);
  const startPoint = useRef(null);
  const selectionRectRef = useRef(null);
  const isDrawing = useRef(false);
  const compareSelectionModeRef = useRef(false);
  const aircraftMarkerRef = useRef(null);
  const aircraftFrameRef = useRef(null);

  const [mapReady, setMapReady] = useState(false);
  const [mapNotice, setMapNotice] = useState('');
  const [drawMode, setDrawMode] = useState(false);
  const [selectionRect, setSelectionRect] = useState(null);
  const [bbox, setBbox] = useState(null);
  const [coords, setCoords] = useState({ lng: ISTANBUL_CENTER[0], lat: ISTANBUL_CENTER[1] });
  const [regionName, setRegionName] = useState('Istanbul Expert Analysis');
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [ingestJob, setIngestJob] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [compareResult, setCompareResult] = useState(null);
  const [manualCompareResult, setManualCompareResult] = useState(null);
  const [baseTone, setBaseTone] = useState('light');
  const [mapControlsOpen, setMapControlsOpen] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState('region');
  const [buildingLayer, setBuildingLayer] = useState(emptyCollection);
  const [showBuildings, setShowBuildings] = useState(true);
  const [roadLayer, setRoadLayer] = useState(emptyCollection);
  const [showRoads, setShowRoads] = useState(true);
  const [routeForm, setRouteForm] = useState(DEFAULT_EXPERT_ROUTE);
  const [routePickMode, setRoutePickMode] = useState(null);
  const [routePoints, setRoutePoints] = useState(DEFAULT_ROUTE_POINTS);
  const [routeResult, setRouteResult] = useState(null);
  const [airspaceSummary, setAirspaceSummary] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [jobProgress, setJobProgress] = useState({
    open: false,
    phase: '',
    percent: 0,
    message: '',
  });
  const [hoveredCell, setHoveredCell] = useState(null);
  const [selectedCellDetail, setSelectedCellDetail] = useState(null);
  const [selectedCellLoading, setSelectedCellLoading] = useState(false);
  const [compareSelectionMode, setCompareSelectionMode] = useState(false);
  const [selectedCompareCells, setSelectedCompareCells] = useState([]);
  const [compareCriteria, setCompareCriteria] = useState('total');
  const [manualCompareCriteria, setManualCompareCriteria] = useState('total');
  const [windVisible, setWindVisible] = useState(true);
  const [windSnapshot, setWindSnapshot] = useState(null);
  const [savedHistory, setSavedHistory] = useState([]);
  const [exportedReports, setExportedReports] = useState([]);
  const [saveDraftName, setSaveDraftName] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [profileName, setProfileName] = useState(user?.full_name || '');
  const [profilePassword, setProfilePassword] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const pulseRef = useRef(null);
  const windFrameRef = useRef(null);

  const weightTotal = useMemo(() => Object.values(weights).reduce((sum, value) => sum + Number(value || 0), 0), [weights]);
  const canRunAnalysis = ingestJob?.status === 'success' || ingestJob?.status === 'partial_success';
  const currentAnalysisVersion = analysisResult?.version ?? analysis?.version ?? null;

  useEffect(() => {
    if (!analysisResult) return;
    setSaveDraftName((prev) => prev || analysisResult.region_name || regionName || 'Saved Analysis');
  }, [analysisResult, regionName]);

  useEffect(() => {
    setProfileName(user?.full_name || '');
  }, [user?.full_name]);

  const fetchAirspace = useCallback(async (bounds) => {
    if (!map.current) return;
    const source = map.current.getSource('airspace-overlay');
    if (!source) return;
    try {
      const response = await axios.get('/api/geodata/airspace', { params: bounds });
      source.setData(response.data);
      setAirspaceSummary(response.data.summary);
    } catch (err) {
      source.setData(emptyCollection);
      setAirspaceSummary(null);
    }
  }, []);

  useEffect(() => {
    if (map.current || !mapContainer.current) return;
    const token = process.env.REACT_APP_MAPBOX_TOKEN;
    if (hasMapboxToken()) {
      mapboxgl.accessToken = token;
    } else {
      mapboxgl.accessToken = 'not-required-for-osm-raster-style';
      setMapNotice('OpenStreetMap basemap active.');
    }

    const instance = new mapboxgl.Map({
      container: mapContainer.current,
      style: getMapStyle(),
      center: ISTANBUL_CENTER,
      zoom: ISTANBUL_ZOOM,
      attributionControl: false,
      preserveDrawingBuffer: true,
    });
    map.current = instance;

    instance.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
    instance.on('error', (event) => {
      const message = event?.error?.message || 'Map could not load.';
      if (message.includes('layers.best-candidate-flash.paint.fill-extrusion-opacity: data expressions not supported')) {
        return;
      }
      setMapNotice(`Map service warning: ${message}`);
    });
    instance.on('mousemove', (event) => setCoords({ lng: event.lngLat.lng, lat: event.lngLat.lat }));
    instance.on('load', () => {
      setMapReady(true);
      instance.resize();

      instance.addSource('bbox-source', { type: 'geojson', data: emptyCollection });
      instance.addLayer({
        id: 'bbox-fill',
        type: 'fill',
        source: 'bbox-source',
        paint: { 'fill-color': '#b65f70', 'fill-opacity': 0.12 },
      });
      instance.addLayer({
        id: 'bbox-outline',
        type: 'line',
        source: 'bbox-source',
        paint: { 'line-color': '#e17b8f', 'line-width': 2, 'line-dasharray': [3, 2] },
      });
      instance.addSource('analysis-heatmap', { type: 'geojson', data: emptyCollection });
      instance.addSource('airspace-overlay', { type: 'geojson', data: emptyCollection });
      instance.addLayer({
        id: 'airspace-nfz-fill',
        type: 'fill',
        source: 'airspace-overlay',
        filter: ['==', ['get', 'zone_category'], 'nfz'],
        paint: { 'fill-color': '#ef4444', 'fill-opacity': 0.24 },
      });
      instance.addLayer({
        id: 'airspace-nfz-line',
        type: 'line',
        source: 'airspace-overlay',
        filter: ['==', ['get', 'zone_category'], 'nfz'],
        paint: { 'line-color': '#f87171', 'line-width': 2 },
      });
      instance.addLayer({
        id: 'airspace-controlled-fill',
        type: 'fill',
        source: 'airspace-overlay',
        filter: ['==', ['get', 'zone_category'], 'controlled_airspace'],
        paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.16 },
      });
      instance.addLayer({
        id: 'airspace-controlled-line',
        type: 'line',
        source: 'airspace-overlay',
        filter: ['==', ['get', 'zone_category'], 'controlled_airspace'],
        paint: { 'line-color': '#60a5fa', 'line-width': 2 },
      });
      instance.addLayer({
        id: 'analysis-heatmap-fill',
        type: 'fill',
        source: 'analysis-heatmap',
        paint: {
          'fill-color': [
            'step',
            ['get', 'suitability_score'],
            '#991b1b',
            30, '#ef4444',
            60, '#f59e0b',
            80, '#22c55e',
            95, '#16a34a',
          ],
          'fill-opacity': 0.42,
        },
      });
      instance.addLayer({
        id: 'analysis-heatmap-line',
        type: 'line',
        source: 'analysis-heatmap',
        paint: { 'line-color': 'rgba(255,255,255,0.45)', 'line-width': 0.7 },
      });
      instance.addSource('selected-cell', { type: 'geojson', data: emptyCollection });
      instance.addLayer({
        id: 'selected-cell-fill',
        type: 'fill',
        source: 'selected-cell',
        paint: {
          'fill-color': '#22c55e',
          'fill-opacity': 0.16,
        },
      });
      instance.addLayer({
        id: 'selected-cell-line',
        type: 'line',
        source: 'selected-cell',
        paint: {
          'line-color': '#bbf7d0',
          'line-width': 3,
        },
      });
      instance.addSource('compare-cells', { type: 'geojson', data: emptyCollection });
      instance.addLayer({
        id: 'compare-cells-fill',
        type: 'fill',
        source: 'compare-cells',
        paint: {
          'fill-color': '#fbbf24',
          'fill-opacity': 0.12,
        },
      });
      instance.addLayer({
        id: 'compare-cells-line',
        type: 'line',
        source: 'compare-cells',
        paint: {
          'line-color': '#fbbf24',
          'line-width': 2.4,
          'line-dasharray': [2, 1.5],
        },
      });
      instance.addSource('expert-roads', { type: 'geojson', data: emptyCollection });
      instance.addLayer({
        id: 'expert-roads-line',
        type: 'line',
        source: 'expert-roads',
        paint: { 'line-color': '#38bdf8', 'line-width': 1.7, 'line-opacity': 0.62 },
      });
      instance.addSource('expert-buildings', { type: 'geojson', data: emptyCollection });
      instance.addLayer({
        id: 'expert-buildings-fill',
        type: 'fill',
        source: 'expert-buildings',
        paint: { 'fill-color': '#e2e8f0', 'fill-opacity': 0.22 },
      });
      instance.addLayer({
        id: 'expert-buildings-line',
        type: 'line',
        source: 'expert-buildings',
        paint: { 'line-color': '#f8fafc', 'line-width': 1.2, 'line-opacity': 0.82 },
      });
      instance.addSource('expert-route', { type: 'geojson', data: emptyCollection });
      instance.addLayer({
        id: 'expert-route-line',
        type: 'line',
        source: 'expert-route',
        paint: { 'line-color': '#f97316', 'line-width': 6, 'line-opacity': 1, 'line-dasharray': [1.4, 0.8] },
      });
      instance.addSource('expert-route-points', { type: 'geojson', data: emptyCollection });
      instance.addLayer({
        id: 'expert-route-point-circles',
        type: 'circle',
        source: 'expert-route-points',
        paint: {
          'circle-radius': 8,
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });

      instance.addSource('top-pulse', { type: 'geojson', data: emptyCollection });
      instance.addLayer({
        id: 'top-pulse-layer',
        type: 'circle',
        source: 'top-pulse',
        paint: {
          'circle-radius': ['get', 'radius'],
          'circle-color': '#00ff88',
          'circle-opacity': ['get', 'opacity'],
          'circle-stroke-width': 0,
        },
      });

      instance.addSource('best-candidate', { type: 'geojson', data: emptyCollection });
      instance.addLayer({
        id: 'best-candidate-flash',
        type: 'fill',
        source: 'best-candidate',
        paint: {
          'fill-color': '#00ff88',
          'fill-opacity': ['get', 'opacity'],
        },
      });

      instance.addSource('wind-lines', { type: 'geojson', data: emptyCollection });
      instance.addLayer({
        id: 'wind-lines-layer',
        type: 'line',
        source: 'wind-lines',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#60a5fa',
          'line-width': 3.2,
          'line-opacity': 0.72,
          'line-dasharray': [2, 4],
        },
      });

      instance.on('mousemove', 'analysis-heatmap-fill', (e) => {
        if (e.features.length > 0) {
          const feature = e.features[0];
          setHoveredCell({
            lngLat: e.lngLat,
            point: e.point,
            props: feature.properties,
            scores: readFeatureCriteriaScores(feature.properties),
          });
          instance.getCanvas().style.cursor = 'pointer';
        }
      });

      instance.on('click', 'analysis-heatmap-fill', (e) => {
        if (!e.features?.length) return;
        const feature = e.features[0];
        if (compareSelectionModeRef.current) {
          toggleCompareCell(feature);
          return;
        }
        inspectCell(Number(feature.properties.analysis_id), feature.properties.cell_index);
      });

      instance.on('mouseleave', 'analysis-heatmap-fill', () => {
        setHoveredCell(null);
        instance.getCanvas().style.cursor = '';
      });

      fetchAirspace(ISTANBUL_AIRSPACE_BOUNDS);
      applyRasterBasemapMode(instance, 'light');
    });
    return () => {
      if (aircraftFrameRef.current) cancelAnimationFrame(aircraftFrameRef.current);
      if (windFrameRef.current) cancelAnimationFrame(windFrameRef.current);
      if (aircraftMarkerRef.current) aircraftMarkerRef.current.remove();
      if (instance) {
        instance.remove();
        if (map.current === instance) {
          map.current = null;
        }
      }
    };
  }, [fetchAirspace]);

  useEffect(() => {
    if (!mapReady || !map.current) return;
    map.current.getSource('bbox-source')?.setData(bbox ? bboxToFeature(bbox) : emptyCollection);
  }, [bbox, mapReady]);

  const updateProgress = useCallback((patch) => {
    setJobProgress((prev) => ({ ...prev, open: true, ...patch }));
  }, []);

  useEffect(() => {
    if (!mapReady || !map.current) return;
    fetchAirspace(ISTANBUL_AIRSPACE_BOUNDS);
  }, [fetchAirspace, mapReady]);

  useEffect(() => {
    if (!mapReady || !map.current) return;
    const instance = map.current;
    if (instance.getLayer('wind-lines-layer')) {
      instance.setLayoutProperty('wind-lines-layer', 'visibility', windVisible ? 'visible' : 'none');
    }
  }, [windVisible, mapReady]);

  useEffect(() => {
    if (!mapReady || !map.current || !windVisible) return;
    let active = true;

    const loadWindSnapshot = async () => {
      try {
        const center = map.current?.getCenter();
        if (!center) return;
        const response = await axios.get('/api/geodata/wind', {
          params: { lat: center.lat, lng: center.lng },
        });
        if (active) setWindSnapshot(response.data);
      } catch (_err) {
        if (active) {
          setWindSnapshot({
            source: 'fallback',
            condition: 'standard',
            wind_kmh: 12,
            wind_direction_deg: 70,
            wind_gusts_kmh: null,
            wind_80m_kmh: 12,
            wind_80m_direction_deg: 70,
            wind_120m_kmh: 12,
            wind_120m_direction_deg: 70,
            temperature_2m_c: null,
            precipitation_mm: null,
            visibility_m: null,
            weather_code: null,
            is_fallback: true,
            is_safe: true,
            warning: 'Live wind feed unavailable. Showing standard directional flow.',
          });
        }
      }
    };

    loadWindSnapshot();
    const intervalId = window.setInterval(loadWindSnapshot, 300000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [mapReady, windVisible]);

  useEffect(() => {
    if (!mapReady || !map.current) return;
    const source = map.current.getSource('expert-route-points');
    if (!source) return;
    source.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [routePoints.from.lng, routePoints.from.lat] },
          properties: { role: 'from', color: '#22c55e' },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [routePoints.to.lng, routePoints.to.lat] },
          properties: { role: 'to', color: '#ef4444' },
        },
      ],
    });
  }, [mapReady, routePoints]);

  useEffect(() => {
    if (!mapReady || !map.current) return;
    const instance = map.current;
    if (!windVisible) {
      if (windFrameRef.current) cancelAnimationFrame(windFrameRef.current);
      instance.getSource('wind-lines')?.setData(emptyCollection);
      return;
    }

    const bounds = ISTANBUL_AIRSPACE_BOUNDS;
    const directionDeg = Number(
      windSnapshot?.wind_80m_direction_deg
      ?? windSnapshot?.wind_direction_deg
      ?? windSnapshot?.wind_120m_direction_deg
      ?? 70
    );
    const speedKmh = Number(
      windSnapshot?.wind_80m_kmh
      ?? windSnapshot?.wind_kmh
      ?? windSnapshot?.wind_120m_kmh
      ?? 12
    );
    const angle = ((directionDeg - 90) * Math.PI) / 180;
    const lngScale = 0.032 + Math.min(speedKmh, 80) / 2500;
    const latScale = 0.016 + Math.min(speedKmh, 80) / 5000;
    const lines = [];
    for (let lat = bounds.south + 0.03; lat <= bounds.north; lat += 0.07) {
      for (let lng = bounds.west + 0.04; lng <= bounds.east; lng += 0.11) {
        const dx = Math.cos(angle) * lngScale;
        const dy = Math.sin(angle) * latScale;
        lines.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [[lng - dx, lat - dy], [lng + dx, lat + dy]],
          },
        });
      }
    }

    let dashOffset = 0;
    const animateWind = () => {
      dashOffset = (dashOffset + 0.15) % 6;
      if (instance.getLayer('wind-lines-layer')) {
        instance.setPaintProperty('wind-lines-layer', 'line-dasharray', [0.2, dashOffset, 1.4, Math.max(1, 6 - dashOffset)]);
        instance.setPaintProperty('wind-lines-layer', 'line-width', Math.max(2.8, Math.min(5.4, 2.2 + speedKmh / 22)));
        instance.setPaintProperty('wind-lines-layer', 'line-opacity', windSnapshot?.is_fallback ? 0.6 : 0.9);
      }
      windFrameRef.current = requestAnimationFrame(animateWind);
    };

    instance.getSource('wind-lines')?.setData({ type: 'FeatureCollection', features: lines });
    if (instance.getLayer('wind-lines-layer')) {
      instance.moveLayer('wind-lines-layer');
    }
    animateWind();

    return () => {
      if (windFrameRef.current) cancelAnimationFrame(windFrameRef.current);
    };
  }, [mapReady, windVisible, windSnapshot]);

  useEffect(() => {
    if (!mapReady || !map.current) return;
    const source = map.current.getSource('expert-buildings');
    if (!source) return;
    source.setData(buildingCollection(buildingLayer));
  }, [buildingLayer, mapReady]);

  useEffect(() => {
    if (!mapReady || !map.current) return;
    const source = map.current.getSource('expert-roads');
    if (!source) return;
    source.setData(buildingCollection(roadLayer));
  }, [mapReady, roadLayer]);

  useEffect(() => {
    if (!mapReady || !map.current) return;
    const visibility = showBuildings ? 'visible' : 'none';
    if (map.current.getLayer('expert-buildings-fill')) {
      map.current.setLayoutProperty('expert-buildings-fill', 'visibility', visibility);
    }
    if (map.current.getLayer('expert-buildings-line')) {
      map.current.setLayoutProperty('expert-buildings-line', 'visibility', visibility);
    }
  }, [mapReady, showBuildings]);

  useEffect(() => {
    if (!mapReady || !map.current) return;
    const visibility = showRoads ? 'visible' : 'none';
    if (map.current.getLayer('expert-roads-line')) {
      map.current.setLayoutProperty('expert-roads-line', 'visibility', visibility);
    }
  }, [mapReady, showRoads]);

  useEffect(() => {
    if (!mapReady || !map.current) return;
    applyRasterBasemapMode(map.current, baseTone);
  }, [baseTone, mapReady]);

  useEffect(() => {
    compareSelectionModeRef.current = compareSelectionMode;
  }, [compareSelectionMode]);

  useEffect(() => {
    setManualCompareResult(null);
  }, [selectedCompareCells]);

  useEffect(() => {
    if (!mapReady || !map.current) return;
    const source = map.current.getSource('selected-cell');
    if (!source) return;

    if (!selectedCellDetail?.geometry) {
      source.setData(emptyCollection);
      return;
    }

    source.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: selectedCellDetail.geometry,
          properties: {
            cell_index: selectedCellDetail.cell_index,
            suitability_score: selectedCellDetail.suitability_score,
          },
        },
      ],
    });
  }, [mapReady, selectedCellDetail]);

  useEffect(() => {
    if (!mapReady || !map.current) return;
    const source = map.current.getSource('compare-cells');
    if (!source) return;

    if (!selectedCompareCells.length) {
      source.setData(emptyCollection);
      return;
    }

    source.setData({
      type: 'FeatureCollection',
      features: selectedCompareCells
        .filter((cell) => cell.geometry)
        .map((cell) => ({
          type: 'Feature',
          geometry: cell.geometry,
          properties: {
            cell_index: cell.cell_index,
            suitability_score: cell.suitability_score,
          },
        })),
    });
  }, [mapReady, selectedCompareCells]);

  const setHeatmap = useCallback((geojson) => {
    const source = map.current?.getSource('analysis-heatmap');
    if (!source) return;
    source.setData(geojson || emptyCollection);
    if (geojson?.features?.length) {
      const polygonFeatures = geojson.features.filter((feature) => (
        Array.isArray(feature?.geometry?.coordinates?.[0]) && feature.geometry.coordinates[0].length > 0
      ));
      if (polygonFeatures.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        polygonFeatures.forEach((feature) => {
          feature.geometry.coordinates[0].forEach((coord) => {
            if (Array.isArray(coord) && coord.length >= 2) bounds.extend(coord);
          });
        });
        fitBoundsSafely(map.current, bounds, { padding: 72, duration: 1200, pitch: 45, bearing: -15 });
      }

      // Prepare pulse source for top 3 and beacon for #1
      const top3 = polygonFeatures
        .filter((f) => f.properties.suitability_score >= 80)
        .slice(0, 3)
        .map((f, i) => {
          const coords = f.geometry.coordinates[0];
          const avgLng = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
          const avgLat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
          return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [avgLng, avgLat] },
            properties: { id: f.properties.cell_index, rank: i + 1 },
          };
        });
 
      // Robust Max Score Finding
      const rank1 = polygonFeatures.reduce((prev, curr) => 
        (prev.properties.suitability_score > curr.properties.suitability_score) ? prev : curr
      , polygonFeatures[0]);

      let step = 0;
      const animatePulse = () => {
        step = (step + 1.2) % 100; // Slightly faster time step
        const pulseOpacity = 0.6 - Math.sin(step / 10) * 0.4;
        const flashOpacity = 0.3 + Math.abs(Math.sin(step / 8)) * 0.5; // Slower, softer flash
        
        if (map.current?.getSource('top-pulse')) {
          map.current.getSource('top-pulse').setData({
            type: 'FeatureCollection',
            features: top3.map((f) => ({
              ...f,
              properties: { ...f.properties, radius: 15 + Math.sin(step / 10) * 10, opacity: pulseOpacity },
            })),
          });
        }

        if (map.current?.getSource('best-candidate') && rank1) {
          map.current.getSource('best-candidate').setData({
            type: 'Feature',
            geometry: rank1.geometry,
            properties: { 
              opacity: flashOpacity
            }
          });
        }

        pulseRef.current = requestAnimationFrame(animatePulse);
      };
      if (pulseRef.current) cancelAnimationFrame(pulseRef.current);
      if (polygonFeatures.length === 0) {
        map.current?.getSource('top-pulse')?.setData(emptyCollection);
        map.current?.getSource('best-candidate')?.setData(emptyCollection);
        return;
      }
      if (top3.length > 0) animatePulse();
    }
  }, []);

  const loadIngestLayers = useCallback(async (jobId) => {
    if (!jobId) return;
    try {
      const response = await axios.get(`/api/geodata/ingest/${jobId}/layers`);
      setBuildingLayer(buildingCollection(response.data.buildings));
      setRoadLayer(buildingCollection(response.data.roads));
    } catch (_err) {
      setBuildingLayer(emptyCollection);
      setRoadLayer(emptyCollection);
    }
  }, []);

  const setRouteLayer = useCallback((route) => {
    const source = map.current?.getSource('expert-route');
    if (!source) return;
    if (!route?.coordinates?.length) {
      source.setData(emptyCollection);
      map.current?.setPaintProperty('expert-route-line', 'line-color', '#f97316');
      if (aircraftFrameRef.current) cancelAnimationFrame(aircraftFrameRef.current);
      if (aircraftMarkerRef.current) {
        aircraftMarkerRef.current.remove();
        aircraftMarkerRef.current = null;
      }
      return;
    }
    source.setData({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: route.coordinates },
      properties: { route_id: route.route_id, safety_status: route.safety_status },
    });
    map.current?.setPaintProperty('expert-route-line', 'line-color', routeLineColor(route));
    const bounds = new mapboxgl.LngLatBounds();
    route.coordinates.forEach((coord) => bounds.extend(coord));
    fitBoundsSafely(map.current, bounds, { padding: 82, duration: 900 });

    if (aircraftFrameRef.current) cancelAnimationFrame(aircraftFrameRef.current);
    if (aircraftMarkerRef.current) aircraftMarkerRef.current.remove();
    const isBlocked = route.is_safe === false || route.safety_status === 'blocked' || route.safety_status === 'unsafe' || route.safety_status === 'weather_risk';
    aircraftMarkerRef.current = new mapboxgl.Marker({ element: createAircraftElement(isBlocked) })
      .setLngLat(route.coordinates[0])
      .addTo(map.current);
    const endProgress = isBlocked ? routeStopProgress(route) : 1;
    const stopPoint = isBlocked ? routeStopPoint(route) : null;
    const durationMs = isBlocked ? 2400 : 4200;
    const startTime = performance.now();
    const animate = (now) => {
      const raw = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - ((1 - raw) ** 3);
      const point = raw >= 1 && stopPoint ? stopPoint : routePointAt(route.coordinates, eased * endProgress);
      if (point && aircraftMarkerRef.current) aircraftMarkerRef.current.setLngLat(point);
      if (raw < 1) aircraftFrameRef.current = requestAnimationFrame(animate);
    };
    aircraftFrameRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (!mapReady || !map.current || !routePickMode) return undefined;
    const instance = map.current;
    const handleClick = (event) => {
      const nextPoint = {
        lat: Number(event.lngLat.lat.toFixed(6)),
        lng: Number(event.lngLat.lng.toFixed(6)),
        name: routePickMode === 'from' ? 'Expert selected origin' : 'Expert selected destination',
      };
      setRoutePoints((prev) => ({ ...prev, [routePickMode]: nextPoint }));
      setRouteResult(null);
      setRouteLayer(null);
      setRoutePickMode(routePickMode === 'from' ? 'to' : null);
    };
    instance.getCanvas().style.cursor = 'crosshair';
    instance.on('click', handleClick);
    return () => {
      instance.off('click', handleClick);
      instance.getCanvas().style.cursor = '';
    };
  }, [mapReady, routePickMode, setRouteLayer]);

  const resetExpertRoute = useCallback(() => {
    setRoutePickMode(null);
    setRoutePoints(DEFAULT_ROUTE_POINTS);
    setRouteForm(DEFAULT_EXPERT_ROUTE);
    setRouteResult(null);
    setRouteLayer(null);
  }, [setRouteLayer]);

  const swapExpertRoute = useCallback(() => {
    setRoutePickMode(null);
    setRoutePoints((prev) => ({ from: prev.to, to: prev.from }));
    setRouteResult(null);
    setRouteLayer(null);
  }, [setRouteLayer]);

  const normalizeWeights = useCallback(() => {
    const total = Object.values(weights).reduce((sum, v) => sum + Number(v || 0), 0);
    if (total === 0) {
      setWeights(DEFAULT_WEIGHTS);
      return;
    }
    const nextWeights = {};
    Object.keys(weights).forEach((k) => {
      nextWeights[k] = Number((weights[k] / total).toFixed(4));
    });
    setWeights(nextWeights);
  }, [weights]);

  const selectDefaultArea = useCallback(() => {
    const centralIstanbul = {
      west: 28.92,
      east: 29.04,
      south: 40.98,
      north: 41.06,
    };
    setBbox(centralIstanbul);
    setWeights(DEFAULT_WEIGHTS);
    if (map.current) {
      map.current.flyTo({
        center: [28.98, 41.02],
        zoom: 12,
        duration: 1200,
      });
    }
  }, []);

  const clearSelection = useCallback(() => {
    setBbox(null);
    setWeights(DEFAULT_WEIGHTS);
    setSelectionRect(null);
    selectionRectRef.current = null;
    setIngestJob(null);
    setAnalysis(null);
    setAnalysisResult(null);
    setCompareResult(null);
    setAirspaceSummary(null);
    setHeatmap(emptyCollection);
    setRouteResult(null);
    setRouteLayer(null);
  }, [setHeatmap, setRouteLayer]);

  const handleMouseDown = useCallback((event) => {
    if (!drawOverlay.current) return;
    isDrawing.current = true;
    const rect = drawOverlay.current.getBoundingClientRect();
    startPoint.current = { x: event.clientX - rect.left, y: event.clientY - rect.top, clientX: event.clientX, clientY: event.clientY };
    selectionRectRef.current = null;
    setSelectionRect(null);
  }, []);

  const handleMouseMove = useCallback((event) => {
    if (!isDrawing.current || !startPoint.current || !drawOverlay.current) return;
    const rect = drawOverlay.current.getBoundingClientRect();
    const cx = event.clientX - rect.left;
    const cy = event.clientY - rect.top;
    const next = {
      left: Math.min(startPoint.current.x, cx),
      top: Math.min(startPoint.current.y, cy),
      width: Math.abs(cx - startPoint.current.x),
      height: Math.abs(cy - startPoint.current.y),
    };
    selectionRectRef.current = next;
    setSelectionRect(next);
  }, []);

  const handleMouseUp = useCallback((event) => {
    if (!isDrawing.current || !map.current || !mapContainer.current) return;
    isDrawing.current = false;
    const currentRect = selectionRectRef.current;
    if (!currentRect || currentRect.width < 12 || currentRect.height < 12) {
      setSelectionRect(null);
      selectionRectRef.current = null;
      startPoint.current = null;
      return;
    }
    const rect = mapContainer.current.getBoundingClientRect();
    const p1 = map.current.unproject([startPoint.current.clientX - rect.left, startPoint.current.clientY - rect.top]);
    const p2 = map.current.unproject([event.clientX - rect.left, event.clientY - rect.top]);

    const west = Number(Math.min(p1.lng, p2.lng).toFixed(6));
    const east = Number(Math.max(p1.lng, p2.lng).toFixed(6));
    const south = Number(Math.min(p1.lat, p2.lat).toFixed(6));
    const north = Number(Math.max(p1.lat, p2.lat).toFixed(6));

    if (west < ISTANBUL_AIRSPACE_BOUNDS.west || east > ISTANBUL_AIRSPACE_BOUNDS.east || south < ISTANBUL_AIRSPACE_BOUNDS.south || north > ISTANBUL_AIRSPACE_BOUNDS.north) {
      setError('selected area is outside of boundaries');
      setSelectionRect(null);
      selectionRectRef.current = null;
      startPoint.current = null;
      setDrawMode(false);
      return;
    }

    setBbox({ west, east, south, north });
    setWeights(DEFAULT_WEIGHTS);
    setSelectionRect(null);
    selectionRectRef.current = null;
    startPoint.current = null;
    setDrawMode(false);
    setIngestJob(null);
    setAnalysis(null);
    setAnalysisResult(null);
    setCompareResult(null);
    setAirspaceSummary(null);
    setHeatmap(emptyCollection);
    setBuildingLayer(emptyCollection);
    setRoadLayer(emptyCollection);
  }, [setHeatmap]);

  const pollIngest = async (jobId) => {
    for (let attempt = 0; attempt < 180; attempt += 1) {
      const response = await axios.get(`/api/geodata/ingest/${jobId}`);
      setIngestJob(response.data);
      const isPaused = response.data.status === 'paused';
      const percent = response.data.status === 'running'
        ? Math.min(15 + Math.round((attempt / 180) * 70), 92)
        : isPaused
          ? Math.min(15 + Math.round((attempt / 180) * 70), 88)
          : 100;
      updateProgress({
        phase: 'Geodata Ingest',
        percent,
        message: response.data.status === 'running'
          ? 'OSM, H3, NFZ and controlled airspace layers are being prepared.'
          : isPaused
            ? (response.data.message || 'Geodata ingest is paused. Resume when you are ready.')
            : `Geodata ingest ${response.data.status}.`,
      });
      if (['success', 'partial_success', 'failed'].includes(response.data.status)) return response.data;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error('Geodata ingest is still running. Keep the page open and try status again shortly.');
  };

  const pollAnalysis = async (analysisId) => {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const response = await axios.get(`/api/analysis/${analysisId}/status`);
      setAnalysis(response.data);
      const isPaused = response.data.status === 'paused';
      const percent = response.data.status === 'running'
        ? Math.min(72 + Math.round((attempt / 120) * 22), 96)
        : isPaused
          ? Math.min(72 + Math.round((attempt / 120) * 22), 92)
          : 100;
      updateProgress({
        phase: 'AHP/TOPSIS Analysis',
        percent,
        message: response.data.status === 'running'
          ? 'Suitability scores and heatmap polygons are being calculated.'
          : isPaused
            ? (response.data.message || 'Analysis is paused. Resume to continue scoring.')
            : `Analysis ${response.data.status}.`,
      });
      if (['completed', 'failed'].includes(response.data.status)) return response.data;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error('Analysis did not finish in time.');
  };

  const inspectCell = async (analysisId, cellIndex) => {
    if (!analysisId || !cellIndex) return;
    setSelectedCellLoading(true);
    try {
      const response = await axios.get(`/api/analysis/${analysisId}/cells/${cellIndex}`);
      setSelectedCellDetail(response.data);
      setActiveWorkspace('results');
      const coordinates = response.data?.geometry?.coordinates?.[0];
      if (map.current && Array.isArray(coordinates) && coordinates.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        coordinates.forEach((coord) => bounds.extend(coord));
        fitBoundsSafely(map.current, bounds, { padding: 120, duration: 800, pitch: 45, bearing: -15, maxZoom: 14.5 });
      }
    } catch (err) {
      setError(readApiError(err));
    } finally {
      setSelectedCellLoading(false);
    }
  };

  const toggleCompareCell = (feature) => {
    const cellIndex = feature?.properties?.cell_index;
    if (!cellIndex) return;

    setSelectedCompareCells((prev) => {
      const exists = prev.some((cell) => cell.cell_index === cellIndex);
      if (exists) {
        return prev.filter((cell) => cell.cell_index !== cellIndex);
      }
      if (prev.length >= 3) {
        setError('You can compare up to 3 cells at a time.');
        return prev;
      }
      return [
        ...prev,
        {
          cell_index: cellIndex,
          suitability_score: Number(feature.properties?.suitability_score || 0),
          geometry: feature.geometry,
        },
      ];
    });
  };

  const runAnalysis = async (jobOverride = null) => {
    const job = jobOverride || ingestJob;
    const isReady = job?.status === 'success' || job?.status === 'partial_success';
    if (!isReady) {
      setError('Run geodata ingest first.');
      return;
    }
    // Auto-normalize if total is close to 1 but not exact, or just normalize anyway to be safe
    const total = Object.values(weights).reduce((sum, v) => sum + Number(v || 0), 0);
    const normalizedWeights = {};
    if (total > 0) {
      Object.keys(weights).forEach((k) => {
        normalizedWeights[k] = weights[k] / total;
      });
    } else {
      Object.assign(normalizedWeights, DEFAULT_WEIGHTS);
    }

    setError('');
    setBusy('analysis');
    setCompareResult(null);
    setManualCompareResult(null);
    setSelectedCellDetail(null);
    setSelectedCompareCells([]);
    setCompareSelectionMode(false);
    updateProgress({
      phase: 'AHP/TOPSIS Analysis',
      percent: 70,
      message: 'Analysis job is starting.',
    });
    try {
      const existingAnalysisId = analysisResult?.analysis_id || analysis?.analysis_id;
      const created = existingAnalysisId
        ? await axios.post(`/api/analysis/${existingAnalysisId}/recalculate`, {
          criteria_weights: normalizedWeights,
          expected_version: currentAnalysisVersion,
        })
        : await axios.post('/api/analysis', {
          geodata_job_id: job.job_id,
          region_name: `${regionName} AHP TOPSIS`,
          criteria_weights: normalizedWeights,
        });
      setAnalysis(created.data);
      const finalStatus = await pollAnalysis(created.data.analysis_id);
      if (finalStatus.status === 'failed') {
        setError('Analysis failed.');
        return;
      }
      const [resultResponse, heatmapResponse] = await Promise.all([
        axios.get(`/api/analysis/${created.data.analysis_id}/result`),
        axios.get(`/api/analysis/${created.data.analysis_id}/heatmap`),
      ]);

      setAnalysisResult(resultResponse.data);
      setHeatmap(heatmapResponse.data);
      setActiveWorkspace('results');
      updateProgress({
        phase: 'Completed',
        percent: 100,
        message: 'Geodata ingest and AHP/TOPSIS analysis completed.',
      });
    } catch (err) {
      setError(readApiError(err));
    } finally {
      setBusy('');
    }
  };

  const runGeodataIngest = async () => {
    if (!bbox) {
      setError('Select an analysis area on the map.');
      return;
    }
    setActiveWorkspace('region');
    setError('');
    setBusy('ingest');
    setAnalysis(null);
    setAnalysisResult(null);
    setCompareResult(null);
    setManualCompareResult(null);
    setSelectedCellDetail(null);
    setSelectedCompareCells([]);
    setCompareSelectionMode(false);
    setHeatmap(emptyCollection);
    updateProgress({
      phase: 'Geodata Ingest',
      percent: 5,
      message: 'Geodata ingest job is starting.',
    });
    try {
      const created = await axios.post('/api/geodata/ingest', {
        region_name: regionName,
        h3_resolution: 8,
        bounding_box: bbox,
      });
      setIngestJob(created.data);
      const finalJob = await pollIngest(created.data.job_id);
      await loadIngestLayers(created.data.job_id);
      if (finalJob.status === 'failed') setError('Geodata ingest failed. Select a smaller Istanbul area and try again.');
      if (finalJob.status === 'partial_success') {
        setError('warning: height data is missing for some buildings in the selected area.');
        await runAnalysis(finalJob);
      } else if (finalJob.status === 'success') {
        await runAnalysis(finalJob);
      }
    } catch (err) {
      if (err.message === 'Network Error' || !err.response) {
        setError('data service is unavailable. check your internet connection');
      } else {
        setError(readApiError(err));
      }
    } finally {
      if (busy !== 'analysis') setBusy('');
    }
  };

  const compareTopCandidates = async () => {
    if (!analysisResult?.top_candidates?.length || !analysisResult?.analysis_id) return;
    setActiveWorkspace('results');
    setBusy('compare');
    setError('');
    try {
      const cellIndexes = analysisResult.top_candidates.slice(0, 3).map((candidate) => candidate.cell_index);
      const response = await axios.post('/api/analysis/compare', { analysis_id: analysisResult.analysis_id, cell_indexes: cellIndexes });
      setCompareResult(response.data);
    } catch (err) {
      setError(readApiError(err));
    } finally {
      setBusy('');
    }
  };

  const compareSelectedCells = async () => {
    if (!analysisResult?.analysis_id || selectedCompareCells.length < 2) return;
    setActiveWorkspace('results');
    setBusy('compare');
    setError('');
    try {
      const response = await axios.post('/api/analysis/compare', {
        analysis_id: analysisResult.analysis_id,
        cell_indexes: selectedCompareCells.map((cell) => cell.cell_index),
      });
      setManualCompareResult(response.data);
      setCompareSelectionMode(false);
    } catch (err) {
      setError(readApiError(err));
    } finally {
      setBusy('');
    }
  };

  const loadSavedHistory = useCallback(async () => {
    try {
      const response = await axios.get('/api/analysis/history');
      setSavedHistory(Array.isArray(response.data?.items) ? response.data.items : []);
    } catch (_err) {
      setSavedHistory([]);
    }
  }, []);

  const loadExportedReports = useCallback(async () => {
    try {
      const response = await axios.get('/api/analysis/reports');
      setExportedReports(Array.isArray(response.data?.items) ? response.data.items : []);
    } catch (_err) {
      setExportedReports([]);
    }
  }, []);

  const downloadReportFile = useCallback(async (downloadUrl, fileName) => {
    const fileResponse = await axios.get(downloadUrl, { responseType: 'blob' });
    const objectUrl = window.URL.createObjectURL(fileResponse.data);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(objectUrl);
  }, []);

  const saveAnalysisToProfile = useCallback(async () => {
    if (!analysisResult?.analysis_id) return;
    if (!saveDraftName.trim()) {
      setError('Enter a name before saving this analysis.');
      return;
    }
    setBusy('save');
    setError('');
    setSuccessMessage('');
    try {
      const center = map.current?.getCenter();
      const payload = {
        name: saveDraftName.trim(),
        expected_version: currentAnalysisVersion,
        map_view: center ? {
          center: [Number(center.lng.toFixed(6)), Number(center.lat.toFixed(6))],
          zoom: Number((map.current?.getZoom() || ISTANBUL_ZOOM).toFixed(2)),
          pitch: Number((map.current?.getPitch() || 0).toFixed(2)),
          bearing: Number((map.current?.getBearing() || 0).toFixed(2)),
        } : {},
        selected_bounds: bbox || {},
      };
      await axios.post(`/api/analysis/${analysisResult.analysis_id}/save`, payload);
      await loadSavedHistory();
      setSuccessMessage('Analysis successfully saved to your profile.');
      setActiveWorkspace('profile');
    } catch (err) {
      setError(readApiError(err));
    } finally {
      setBusy('');
    }
  }, [analysisResult, bbox, currentAnalysisVersion, loadSavedHistory, saveDraftName]);

  const downloadAnalysisExport = useCallback(async (format) => {
    if (!analysisResult?.analysis_id) return;
    setBusy('export');
    setError('');
    setSuccessMessage('');
    try {
      const exportResponse = await axios.get(`/api/analysis/${analysisResult.analysis_id}/export`, {
        params: { format },
      });
      const downloadUrl = exportResponse.data?.download_url;
      if (!downloadUrl) throw new Error('Export download link was not returned by the server.');
      const fileName = exportResponse.data?.file_name || `analysis-${analysisResult.analysis_id}.${format}`;
      await loadExportedReports();
      await downloadReportFile(downloadUrl, fileName);
      setSuccessMessage('Report successfully exported.');
      setActiveWorkspace('exports');
    } catch (err) {
      setError(readApiError(err));
    } finally {
      setBusy('');
    }
  }, [analysisResult, downloadReportFile, loadExportedReports]);

  const downloadExistingReport = useCallback(async (reportItem) => {
    if (!reportItem?.download_url || !reportItem?.file_name) return;
    setBusy('report-download');
    setError('');
    try {
      await downloadReportFile(reportItem.download_url, reportItem.file_name);
    } catch (err) {
      setError(readApiError(err));
    } finally {
      setBusy('');
    }
  }, [downloadReportFile]);

  const deleteExistingReport = useCallback(async (reportItem) => {
    if (!reportItem?.report_id) return;
    setBusy('report-delete');
    setError('');
    setSuccessMessage('');
    try {
      const response = await axios.delete(`/api/analysis/reports/${reportItem.report_id}`);
      await loadExportedReports();
      setSuccessMessage(response.data?.message || 'Report deleted successfully.');
    } catch (err) {
      setError(readApiError(err));
    } finally {
      setBusy('');
    }
  }, [loadExportedReports]);

  const deleteSavedAnalysis = useCallback(async (historyItem) => {
    if (!historyItem?.analysis_id) return;
    setBusy('history-delete');
    setError('');
    setSuccessMessage('');
    try {
      const response = await axios.delete(`/api/analysis/history/${historyItem.analysis_id}`);
      await loadSavedHistory();
      setSuccessMessage(response.data?.message || 'Saved analysis removed from profile.');
    } catch (err) {
      setError(readApiError(err));
    } finally {
      setBusy('');
    }
  }, [loadSavedHistory]);

  const loadSavedAnalysis = useCallback(async (historyItem) => {
    if (!historyItem?.analysis_id) return;
    setBusy('history');
    setError('');
    setSuccessMessage('');
    try {
      const [resultResponse, heatmapResponse] = await Promise.all([
        axios.get(`/api/analysis/${historyItem.analysis_id}/result`),
        axios.get(`/api/analysis/${historyItem.analysis_id}/heatmap`),
      ]);
      setAnalysisResult(resultResponse.data);
      setAnalysis({
        analysis_id: historyItem.analysis_id,
        status: resultResponse.data.status,
        version: resultResponse.data.version ?? historyItem.version ?? null,
      });
      if (historyItem?.saved_payload?.criteria_weights) {
        setWeights((prev) => ({ ...DEFAULT_WEIGHTS, ...prev, ...historyItem.saved_payload.criteria_weights }));
      }
      if (historyItem?.saved_payload?.selected_bounds) {
        setBbox(historyItem.saved_payload.selected_bounds);
      }
      if (historyItem?.saved_name) {
        setSaveDraftName(historyItem.saved_name);
      }
      setHeatmap(heatmapResponse.data);
      setActiveWorkspace('results');

      const selectedBounds = historyItem?.saved_payload?.selected_bounds;
      if (map.current && selectedBounds?.west !== undefined) {
        const bounds = new mapboxgl.LngLatBounds(
          [selectedBounds.west, selectedBounds.south],
          [selectedBounds.east, selectedBounds.north],
        );
        fitBoundsSafely(map.current, bounds, { padding: 72, duration: 900 });
      }
    } catch (err) {
      setError(readApiError(err));
    } finally {
      setBusy('');
    }
  }, [setHeatmap]);

  useEffect(() => {
    loadSavedHistory();
  }, [loadSavedHistory]);

  useEffect(() => {
    loadExportedReports();
  }, [loadExportedReports]);

  const pauseCurrentIngest = useCallback(async () => {
    if (!ingestJob?.job_id) return;
    setBusy('ingest-control');
    setError('');
    setSuccessMessage('');
    try {
      const response = await axios.post(`/api/geodata/ingest/${ingestJob.job_id}/pause`);
      setIngestJob(response.data);
      updateProgress({
        phase: 'Geodata Ingest',
        percent: Math.max(jobProgress.percent || 22, 32),
        message: response.data?.message || 'Geodata ingest paused.',
      });
      setSuccessMessage(response.data?.message || 'Geodata ingest paused.');
    } catch (err) {
      setError(readApiError(err));
    } finally {
      setBusy('');
    }
  }, [ingestJob, jobProgress.percent, updateProgress]);

  const resumeCurrentIngest = useCallback(async () => {
    if (!ingestJob?.job_id) return;
    setBusy('ingest-control');
    setError('');
    setSuccessMessage('');
    try {
      const response = await axios.post(`/api/geodata/ingest/${ingestJob.job_id}/resume`);
      setIngestJob(response.data);
      updateProgress({
        phase: 'Geodata Ingest',
        percent: Math.max(jobProgress.percent || 32, 36),
        message: response.data?.message || 'Geodata ingest resumed.',
      });
      setSuccessMessage(response.data?.message || 'Geodata ingest resumed.');
    } catch (err) {
      setError(readApiError(err));
    } finally {
      setBusy('');
    }
  }, [ingestJob, jobProgress.percent, updateProgress]);

  const pauseCurrentAnalysis = useCallback(async () => {
    const analysisId = analysis?.analysis_id || analysisResult?.analysis_id;
    if (!analysisId) return;
    setBusy('analysis-control');
    setError('');
    setSuccessMessage('');
    try {
      const response = await axios.post(`/api/analysis/${analysisId}/pause`);
      setAnalysis((prev) => ({ ...(prev || {}), ...response.data, analysis_id: analysisId }));
      updateProgress({
        phase: 'AHP/TOPSIS Analysis',
        percent: Math.max(jobProgress.percent || 74, 78),
        message: response.data?.message || 'Analysis paused.',
      });
      setSuccessMessage(response.data?.message || 'Analysis paused.');
    } catch (err) {
      setError(readApiError(err));
    } finally {
      setBusy('');
    }
  }, [analysis, analysisResult, jobProgress.percent, updateProgress]);

  const resumeCurrentAnalysis = useCallback(async () => {
    const analysisId = analysis?.analysis_id || analysisResult?.analysis_id;
    if (!analysisId) return;
    setBusy('analysis-control');
    setError('');
    setSuccessMessage('');
    try {
      const response = await axios.post(`/api/analysis/${analysisId}/resume`);
      setAnalysis((prev) => ({ ...(prev || {}), ...response.data, analysis_id: analysisId }));
      updateProgress({
        phase: 'AHP/TOPSIS Analysis',
        percent: Math.max(jobProgress.percent || 78, 82),
        message: response.data?.message || 'Analysis resumed.',
      });
      setSuccessMessage(response.data?.message || 'Analysis resumed.');
    } catch (err) {
      setError(readApiError(err));
    } finally {
      setBusy('');
    }
  }, [analysis, analysisResult, jobProgress.percent, updateProgress]);

  const saveExpertProfile = useCallback(async () => {
    setProfileSaving(true);
    setError('');
    setProfileMessage('');
    try {
      await updateProfile({
        full_name: profileName,
        password: profilePassword || undefined,
      });
      setProfilePassword('');
      setProfileMessage('Profile updated successfully.');
    } catch (err) {
      setError(readApiError(err));
    } finally {
      setProfileSaving(false);
    }
  }, [profileName, profilePassword, updateProfile]);

  const runExpertRouteSafety = async () => {
    setActiveWorkspace('route');
    setBusy('route');
    setError('');
    setRouteResult(null);
    setRouteLayer(null);
    updateProgress({
      phase: 'Route Safety',
      percent: 18,
      message: 'Booting route safety scan and validating flight corridor.',
    });
    try {
      updateProgress({
        phase: 'Route Safety',
        percent: 42,
        message: 'Checking no-fly zones, obstacle clearance, and wind limits.',
      });
      const response = await axios.post('/api/route', {
        from_point: {
          lat: routePoints.from.lat,
          lng: routePoints.from.lng,
          name: routePoints.from.name || routeForm.fromName || 'Expert route origin',
        },
        to_point: {
          lat: routePoints.to.lat,
          lng: routePoints.to.lng,
          name: routePoints.to.name || routeForm.toName || 'Expert route destination',
        },
        constraints: {
          avoid_nfz: true,
          avoid_obstacles: true,
          max_wind_kmh: Number(routeForm.windLimitKmh || EXPERT_ROUTE_WIND_LIMIT),
        },
      });
      updateProgress({
        phase: 'Route Safety',
        percent: 91,
        message: 'Safe route computed. Rendering route geometry and telemetry.',
      });
      setRouteResult(response.data);
      setRouteLayer(response.data);
    } catch (err) {
      setError(readApiError(err));
    } finally {
      setJobProgress({
        open: false,
        phase: '',
        percent: 0,
        message: '',
      });
      setBusy('');
    }
  };

  const handleLogout = () => {
    logout();
  };

  const renderComparisonCard = (result, title, criteria, onCriteriaChange) => {
    if (!result) return null;
    return (
      <Box sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '8px', p: 1.5 }}>
        <Typography sx={{ color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 800, mb: 1.5 }}>{title}</Typography>
        <Box sx={{ bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '8px', p: 1, mb: 1.5 }}>
          <Typography sx={{ color: '#94a3b8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1 }}>
            Compared cells
          </Typography>
          <Stack spacing={0.8}>
            {result.ranked_candidates.map((candidate, idx) => (
              <Box
                key={`${title}-${candidate.cell_index}`}
                sx={{ display: 'grid', gridTemplateColumns: '18px 76px 1fr auto', gap: 1, alignItems: 'center' }}
              >
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: ['#00ff88', '#00ff00', '#ffff00'][idx] }} />
                <Typography sx={{ color: '#cbd5e1', fontSize: '0.7rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
                  {compareCandidateLabel(idx)}
                </Typography>
                <Tooltip title={candidate.cell_index}>
                  <Typography sx={{ color: '#94a3b8', fontSize: '0.68rem', fontFamily: 'monospace', cursor: 'help', whiteSpace: 'nowrap' }}>
                    {shortCellIndex(candidate.cell_index)}
                  </Typography>
                </Tooltip>
                <Typography sx={{ color: scoreColor(candidate.suitability_score), fontSize: '0.7rem', fontWeight: 900 }}>
                  {candidate.suitability_score.toFixed(1)}%
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
        <Stack direction="row" spacing={0.5} sx={{ mb: 2, flexWrap: 'wrap', gap: 0.5 }}>
          {['total', ...Object.keys(criteriaLabels)].map((key) => (
            <Button
              key={`${title}-${key}`}
              size="small"
              variant={criteria === key ? 'contained' : 'outlined'}
              onClick={() => onCriteriaChange(key)}
              sx={{
                fontSize: '0.62rem',
                textTransform: 'capitalize',
                borderRadius: '4px',
                minWidth: 0,
                px: 1,
                py: 0.2,
                bgcolor: criteria === key ? '#b65f70' : 'transparent',
                borderColor: 'rgba(182, 95, 112, 0.4)',
                color: criteria === key ? '#fff' : '#94a3b8',
                '&:hover': { bgcolor: criteria === key ? '#944b59' : 'rgba(182, 95, 112, 0.1)' },
              }}
            >
              {key === 'total' ? 'Total' : criteriaLabels[key]}
            </Button>
          ))}
        </Stack>
        <Box sx={{ width: '100%', height: 200, mb: 1 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={result.ranked_candidates.map((cand, idx) => ({
              name: idx === 0 ? 'Best' : idx === 1 ? '2nd' : idx === 2 ? '3rd' : `#${idx + 1}`,
              fullLabel: `${compareCandidateLabel(idx)} - ${shortCellIndex(cand.cell_index)}`,
              cellIndex: cand.cell_index,
              value: compareCriterionValue(cand, criteria),
              fill: ['#fec287', '#fb8861', '#b6367a'][idx] || '#ffffff',
            }))}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 9 }} />
              <RechartsTooltip
                cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px' }}
                formatter={(value) => [`${value}%`, criteria === 'total' ? 'Overall suitability' : criteriaLabels[criteria]]}
                labelFormatter={(_, payload) => {
                  const item = payload?.[0]?.payload;
                  return item ? `${item.fullLabel} (${item.cellIndex})` : '';
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
        <Box sx={{ bgcolor: 'rgba(182, 95, 112, 0.08)', borderLeft: '3px solid #b65f70', p: 1.2, mb: 2, borderRadius: '0 4px 4px 0' }}>
          <Typography sx={{ color: '#e2e8f0', fontSize: '0.72rem', fontWeight: 800, mb: 0.4 }}>
            Comparing: {criteria === 'total' ? 'Overall Suitability' : criteriaLabels[criteria]}
          </Typography>
          <Typography sx={{ color: '#94a3b8', fontSize: '0.68rem', lineHeight: 1.4 }}>
            {compareInsightText(result.ranked_candidates, criteria)}
          </Typography>
        </Box>
        <Stack spacing={0.8}>
          {result.ranked_candidates.map((candidate, idx) => (
            <Box key={`${title}-footer-${candidate.cell_index}`} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: 'rgba(255,255,255,0.03)', p: 0.8, borderRadius: '4px' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: ['#00ff88', '#00ff00', '#ffff00'][idx] }} />
                <Box>
                  <Typography sx={{ color: '#cbd5e1', fontSize: '0.72rem', fontWeight: 700 }}>
                    {compareCandidateLabel(idx)}
                  </Typography>
                  <Tooltip title={candidate.cell_index}>
                    <Typography sx={{ color: '#64748b', fontSize: '0.64rem', fontFamily: 'monospace', cursor: 'help' }}>
                      {shortCellIndex(candidate.cell_index)}
                    </Typography>
                  </Tooltip>
                </Box>
              </Box>
              <Typography sx={{ color: ['#fec287', '#fb8861', '#b6367a'][idx], fontSize: '0.72rem', fontWeight: 900 }}>
                {criteria === 'total'
                  ? `${candidate.suitability_score.toFixed(1)}%`
                  : `${compareCriterionValue(candidate, criteria)}%`}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Box>
    );
  };

  const workspacePanelSx = {
    ...panelSx,
    background: 'rgba(2, 6, 23, 0.95)',
    border: '1px solid rgba(225, 123, 143, 0.3)',
    backgroundImage: 'linear-gradient(rgba(225, 123, 143, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(225, 123, 143, 0.04) 1px, transparent 1px)',
    backgroundSize: '20px 20px',
    boxShadow: 'inset 0 0 20px rgba(225, 123, 143, 0.05), 0 10px 32px rgba(0,0,0,0.5)',
    ...scrollPanelSx,
    position: 'absolute',
    top: 148,
    left: 16,
    zIndex: 20,
    width: { xs: 'calc(100% - 32px)', md: 410 },
    maxHeight: 'calc(100vh - 180px)',
    overflow: 'auto',
    p: 2,
  };

  return (
    <Box sx={{ height: '100vh', width: '100%', bgcolor: '#020617', overflow: 'hidden', position: 'relative' }}>
      <div ref={mapContainer} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      {mapNotice && (
        <Alert
          severity={mapNotice.startsWith('Map service warning') ? 'warning' : 'info'}
          icon={false}
          sx={{
            position: 'absolute',
            bottom: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 21,
            maxWidth: 360,
            fontSize: '0.68rem',
            py: 0.25,
            px: 1,
            color: '#cbd5e1',
            bgcolor: 'rgba(2,6,23,0.78)',
            border: '1px solid rgba(148,163,184,0.22)',
            '& .MuiAlert-message': { p: 0 },
          }}
        >
          {mapNotice}
        </Alert>
      )}
      {!mapReady && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', zIndex: 5, pointerEvents: 'none' }}>
          <CircularProgress sx={{ color: '#b65f70' }} />
        </Box>
      )}
      {drawMode && (
        <Box ref={drawOverlay} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} sx={{ position: 'absolute', inset: 0, zIndex: 12, cursor: 'crosshair', userSelect: 'none' }} />
      )}
      {selectionRect && (
        <Box sx={{ position: 'absolute', zIndex: 13, left: selectionRect.left, top: selectionRect.top, width: selectionRect.width, height: selectionRect.height, border: '2px dashed #e17b8f', background: 'rgba(182,95,112,0.12)', pointerEvents: 'none' }} />
      )}

      <Paper sx={{ ...panelSx, position: 'absolute', top: 16, left: 16, right: 16, zIndex: 20, px: 2, py: 1.3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.4 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: '8px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(182,95,112,0.14)', color: '#e17b8f' }}>
            <FlightTakeoffIcon fontSize="small" />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1rem' }}>SkyPort Expert Analysis</Typography>
            <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem' }}>{user?.full_name || 'Expert'} · AHP/TOPSIS suitability workflow</Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Reset to Istanbul">
            <IconButton onClick={() => map.current?.flyTo({ center: ISTANBUL_CENTER, zoom: ISTANBUL_ZOOM, duration: 900 })} sx={{ color: '#94a3b8' }}>
              <MyLocationIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Profile">
            <IconButton onClick={() => setProfileOpen(true)} sx={{ color: '#93c5fd' }}>
              <PersonOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button startIcon={<LogoutIcon />} onClick={handleLogout} sx={{ color: '#fca5a5', borderRadius: '8px', textTransform: 'none' }}>
            Logout
          </Button>
        </Box>
      </Paper>

      <Paper
        sx={{
          position: 'absolute',
          top: 92,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          background: 'rgba(2, 6, 23, 0.92)',
          backdropFilter: 'blur(14px)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        <Tabs
          value={activeWorkspace}
          onChange={(_, nextValue) => setActiveWorkspace(nextValue)}
          sx={{
            minHeight: 44,
            '& .MuiTabs-indicator': { background: 'linear-gradient(90deg, #b65f70, #e17b8f)', height: 2 },
            '& .MuiTab-root': {
              minHeight: 44,
              py: 0,
              px: { xs: 1.5, md: 2.5 },
              color: '#64748b',
              fontWeight: 700,
              fontSize: '0.78rem',
              textTransform: 'none',
              gap: 0.8,
              '&.Mui-selected': { color: '#e2e8f0' },
            },
          }}
        >
          <Tab icon={<MapIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Region" value="region" />
          <Tab icon={<ScienceIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Weights" value="weights" />
          <Tab icon={<RouteIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Route Safety" value="route" />
          <Tab icon={<AnalyticsIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Results" value="results" />
          <Tab icon={<BusinessIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Profile" value="profile" />
          <Tab icon={<DescriptionIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Exports" value="exports" />
        </Tabs>
      </Paper>

      <Fade in={activeWorkspace === 'region'}>
        <Box sx={{ position: 'absolute', inset: 0, zIndex: 19, pointerEvents: 'none' }}>
          <Paper sx={{ ...workspacePanelSx, pointerEvents: activeWorkspace === 'region' ? 'auto' : 'none' }}>
            <Stack spacing={2}>
              <Box>
                <Typography sx={{ color: '#e2e8f0', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <MapIcon fontSize="small" /> Region Selection
                </Typography>
                <Typography sx={{ color: '#94a3b8', fontSize: '0.76rem', mt: 0.5 }}>
                  Draw a bounded Istanbul area, ingest geodata, then run AHP/TOPSIS scoring.
                </Typography>
              </Box>
              <TextField label="Region Name" size="small" value={regionName} onChange={(event) => setRegionName(event.target.value)} sx={fieldSx} />
              <Stack direction="row" spacing={1}>
                <Button fullWidth startIcon={<CropFreeIcon />} variant={drawMode ? 'contained' : 'outlined'} onClick={() => { setDrawMode((prev) => !prev); setError(''); }} sx={{ borderRadius: '8px', textTransform: 'none' }}>
                  {drawMode ? 'Selecting' : 'Draw Area'}
                </Button>
                <Button fullWidth variant="outlined" onClick={selectDefaultArea} sx={{ color: '#ff8da1', borderColor: 'rgba(255,141,161,0.4)', borderRadius: '8px', textTransform: 'none' }}>
                  Default Area
                </Button>
                <Button startIcon={<DeleteOutlineIcon />} onClick={clearSelection} sx={{ color: '#fca5a5', borderRadius: '8px', textTransform: 'none' }}>
                  Clear
                </Button>
              </Stack>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                {['north', 'south', 'west', 'east'].map((key) => (
                  <Box key={key} sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '8px', p: 1 }}>
                    <Typography sx={{ color: '#64748b', fontSize: '0.62rem', fontWeight: 800 }}>{key.toUpperCase()}</Typography>
                    <Typography sx={{ color: '#cbd5e1', fontSize: '0.76rem', fontFamily: 'monospace' }}>{bbox ? Number(bbox[key]).toFixed(6) : 'not set'}</Typography>
                  </Box>
                ))}
              </Box>
              <Button fullWidth variant="contained" onClick={runGeodataIngest} disabled={!bbox || Boolean(busy)} sx={{ bgcolor: '#b65f70', borderRadius: '8px', textTransform: 'none', fontWeight: 800, '&:hover': { bgcolor: '#944b59' } }}>
                {busy === 'ingest' || busy === 'analysis' ? <CircularProgress size={22} color="inherit" /> : 'Run Geodata + Analysis'}
              </Button>
              {ingestJob && (
                <StatusPanel
                  title="Geodata Job"
                  status={ingestJob.status}
                  rows={[
                    ['Job ID', ingestJob.job_id],
                    ['Buildings', ingestJob.layer_counts?.buildings ?? 0],
                    ['Roads', ingestJob.layer_counts?.roads ?? 0],
                    ['Land Use', ingestJob.layer_counts?.land_use ?? 0],
                    ['H3 Cells', ingestJob.layer_counts?.h3_cells ?? 0],
                  ]}
                  warnings={ingestJob.warnings}
                />
              )}
              {ingestJob && ['running', 'paused'].includes(ingestJob.status) && (
                <Stack direction="row" spacing={1}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={ingestJob.status === 'paused' ? resumeCurrentIngest : pauseCurrentIngest}
                    disabled={busy === 'ingest-control'}
                    sx={{ color: '#e2e8f0', borderColor: 'rgba(226,232,240,0.18)', borderRadius: '8px', textTransform: 'none' }}
                  >
                    {busy === 'ingest-control'
                      ? <CircularProgress size={18} color="inherit" />
                      : ingestJob.status === 'paused' ? 'Resume Ingest' : 'Pause Ingest'}
                  </Button>
                </Stack>
              )}
              {Number(ingestJob?.layer_counts?.h3_cells ?? 0) < 3 && ingestJob && (
                <Alert severity="info" sx={{ fontSize: '0.76rem' }}>
                  Select a larger area for a more sensitive TOPSIS comparison. Single-cell results use a weighted MCDM fallback.
                </Alert>
              )}
              {airspaceSummary && (
                <Box sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '8px', p: 1.2 }}>
                  <Typography sx={{ color: '#cbd5e1', fontSize: '0.78rem', fontWeight: 800, mb: 0.8 }}>Istanbul Airspace Overlay</Typography>
                  <Stack direction="row" spacing={1}>
                    <Chip label={`NFZ ${airspaceSummary.nfz ?? 0}`} size="small" sx={{ bgcolor: 'rgba(239,68,68,0.18)', color: '#fca5a5', fontWeight: 800 }} />
                    <Chip label={`Controlled ${airspaceSummary.controlled_airspace ?? 0}`} size="small" sx={{ bgcolor: 'rgba(59,130,246,0.18)', color: '#60a5fa', fontWeight: 800 }} />
                  </Stack>
                </Box>
              )}
            </Stack>
          </Paper>
        </Box>
      </Fade>

      <Fade in={activeWorkspace === 'weights'}>
        <Box sx={{ position: 'absolute', inset: 0, zIndex: 19, pointerEvents: 'none' }}>
          <Paper sx={{ ...workspacePanelSx, pointerEvents: activeWorkspace === 'weights' ? 'auto' : 'none' }}>
            <Stack spacing={2}>
              <Box>
                <Typography sx={{ color: '#e2e8f0', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ScienceIcon fontSize="small" /> AHP/TOPSIS Weights
                </Typography>
                <Typography sx={{ color: '#94a3b8', fontSize: '0.76rem', mt: 0.5 }}>
                  Tune the six-criterion balance across obstacle, transport, land use, NFZ, traffic density, and socioeconomic potential.
                </Typography>
              </Box>
              <Typography sx={{ color: '#94a3b8', fontSize: '0.76rem' }}>
                Total: {weightTotal.toFixed(2)} {Math.abs(weightTotal - 1) > 0.001 && <span style={{ color: '#fca5a5' }}>(will be auto-normalized)</span>}
              </Typography>
              <Button size="small" onClick={normalizeWeights} sx={{ color: '#e17b8f', alignSelf: 'flex-start', textTransform: 'none', mt: -1, fontSize: '0.7rem' }}>
                Click to auto-balance weights now
              </Button>
              {Object.entries(weights).map(([key, value]) => (
                <Box key={key}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                    <Typography sx={{ color: '#cbd5e1', fontSize: '0.78rem' }}>{criteriaLabels[key]}</Typography>
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.78rem' }}>{Number(value).toFixed(2)}</Typography>
                  </Box>
                  <Slider min={0} max={1} step={0.05} value={Number(value)} onChange={(_, nextValue) => setWeights((prev) => ({ ...prev, [key]: Number(nextValue) }))} sx={{ color: '#b65f70', py: 0 }} />
                </Box>
              ))}
              <Button fullWidth variant="contained" startIcon={<AnalyticsIcon />} onClick={() => runAnalysis()} disabled={!canRunAnalysis || Boolean(busy)} sx={{ bgcolor: '#16a34a', borderRadius: '8px', textTransform: 'none', fontWeight: 800, '&:hover': { bgcolor: '#15803d' } }}>
                {busy === 'analysis'
                  ? <CircularProgress size={22} color="inherit" />
                  : (analysisResult?.analysis_id ? 'Save Values / Recalculate' : 'Run AHP/TOPSIS Analysis')}
              </Button>
              {analysis && (
                <StatusPanel
                  title="Analysis Job"
                  status={analysis.status}
                  rows={[
                    ['Analysis ID', analysis.analysis_id],
                    ['Version', analysis.version ?? 'n/a'],
                    ['Started', analysis.started_at ? new Date(analysis.started_at).toLocaleTimeString() : 'pending'],
                    ['Completed', analysis.completed_at ? new Date(analysis.completed_at).toLocaleTimeString() : 'pending'],
                  ]}
                />
              )}
              {analysis && ['running', 'paused'].includes(analysis.status) && (
                <Stack direction="row" spacing={1}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={analysis.status === 'paused' ? resumeCurrentAnalysis : pauseCurrentAnalysis}
                    disabled={busy === 'analysis-control'}
                    sx={{ color: '#e2e8f0', borderColor: 'rgba(226,232,240,0.18)', borderRadius: '8px', textTransform: 'none' }}
                  >
                    {busy === 'analysis-control'
                      ? <CircularProgress size={18} color="inherit" />
                      : analysis.status === 'paused' ? 'Resume Analysis' : 'Pause Analysis'}
                  </Button>
                </Stack>
              )}
            </Stack>
          </Paper>
        </Box>
      </Fade>

      <Fade in={activeWorkspace === 'route'}>
        <Box sx={{ position: 'absolute', inset: 0, zIndex: 19, pointerEvents: 'none' }}>
          <Paper sx={{ ...workspacePanelSx, pointerEvents: activeWorkspace === 'route' ? 'auto' : 'none' }}>
            <Stack spacing={2}>
              <Box>
                <Typography sx={{ color: '#e2e8f0', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <RouteIcon fontSize="small" /> Route Safety
                </Typography>
                <Typography sx={{ color: '#94a3b8', fontSize: '0.76rem', mt: 0.5 }}>
                  Pick two map points to validate an operational corridor against NFZ, controlled airspace, obstacles, and wind.
                </Typography>
              </Box>
              {routePickMode && (
                <Alert severity="info" sx={{ fontSize: '0.74rem' }}>
                  Click the map to set the {routePickMode === 'from' ? 'origin' : 'destination'} point.
                  {routePickMode === 'from' ? ' Destination selection starts after that.' : ''}
                </Alert>
              )}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                <RoutePointCard label="Origin" point={routePoints.from} color="#22c55e" />
                <RoutePointCard label="Destination" point={routePoints.to} color="#ef4444" />
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                <Button
                  variant={routePickMode === 'from' ? 'contained' : 'outlined'}
                  startIcon={<FmdGoodIcon />}
                  onClick={() => {
                    setDrawMode(false);
                    setActiveWorkspace('route');
                    setRoutePickMode('from');
                    setError('');
                  }}
                  sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 800 }}
                >
                  Pick Origin
                </Button>
                <Button
                  variant={routePickMode === 'to' ? 'contained' : 'outlined'}
                  startIcon={<FmdGoodIcon />}
                  onClick={() => {
                    setDrawMode(false);
                    setActiveWorkspace('route');
                    setRoutePickMode('to');
                    setError('');
                  }}
                  sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 800 }}
                >
                  Pick Destination
                </Button>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button fullWidth startIcon={<SwapHorizIcon />} onClick={swapExpertRoute} sx={{ color: '#cbd5e1', borderRadius: '8px', textTransform: 'none' }}>
                  Swap
                </Button>
                <Button fullWidth startIcon={<MyLocationIcon />} onClick={resetExpertRoute} sx={{ color: '#e17b8f', borderRadius: '8px', textTransform: 'none' }}>
                  Defaults
                </Button>
              </Stack>
              <TextField
                label="Operational Wind Limit (km/h)"
                size="small"
                type="number"
                value={routeForm.windLimitKmh}
                onChange={(event) => setRouteForm((prev) => ({ ...prev, windLimitKmh: event.target.value }))}
                helperText="Measured weather is compared against this operational threshold."
                sx={fieldSx}
              />
              <Button fullWidth variant="contained" startIcon={<RouteIcon />} onClick={runExpertRouteSafety} disabled={Boolean(busy)} sx={{ bgcolor: '#7c3aed', borderRadius: '8px', textTransform: 'none', fontWeight: 800, '&:hover': { bgcolor: '#6d28d9' } }}>
                {busy === 'route' ? <CircularProgress size={22} color="inherit" /> : 'Run Route Safety Check'}
              </Button>
              {routeResult && (
                <StatusPanel
                  title="Route Safety"
                  status={routeResult.safety_status}
                  rows={[
                    ['Route ID', routeResult.route_id],
                    ['Distance', `${Number(routeResult.distance_km).toFixed(2)} km`],
                    ['Duration', `${routeResult.duration_min} min`],
                    ['Weather', routeResult.weather?.source === 'open_meteo' ? 'Open-Meteo' : 'Fallback'],
                    ['Safety Limit', routeWeatherSafetyLimit(routeResult)],
                    ['Critical Metric', routeResult.blocking_type === 'weather' ? routeCriticalWeatherMetric(routeResult) : 'n/a'],
                    ['10m Wind', routeResult.weather?.wind_kmh !== undefined && routeResult.weather?.wind_kmh !== null ? `${Number(routeResult.weather.wind_kmh).toFixed(1)} km/h` : 'n/a'],
                    ['80m Wind', routeResult.weather?.wind_80m_kmh !== undefined && routeResult.weather?.wind_80m_kmh !== null ? `${Number(routeResult.weather.wind_80m_kmh).toFixed(1)} km/h` : 'n/a'],
                    ['120m Wind', routeResult.weather?.wind_120m_kmh !== undefined && routeResult.weather?.wind_120m_kmh !== null ? `${Number(routeResult.weather.wind_120m_kmh).toFixed(1)} km/h` : 'n/a'],
                  ]}
                />
              )}
              {routeResult && (
                <CompactWarning
                  title="Obstacle Data"
                  items={[
                    routeResult.obstacle_data_status === 'available'
                      ? `Obstacle data ready (${routeResult.obstacle_feature_count} building features loaded).`
                      : 'Obstacle data missing for this corridor. Run geodata ingest to improve route confidence.',
                  ]}
                  tone={routeResult.obstacle_data_status === 'available' ? 'success' : 'danger'}
                />
              )}
              {routeResult?.blocking_reason && <CompactWarning title="Blocking Status" items={[routeResult.blocking_reason]} tone="danger" />}
              {routeResult?.warnings?.length > 0 && <CompactWarning title="Warnings" items={routeResult.warnings} />}
              {routeResult?.conflicts?.length > 0 && <CompactWarning title="Conflicts" items={routeResult.conflicts.map((conflict) => `${conflict.type.toUpperCase()}: ${conflict.zone_name || conflict.message}`)} tone="danger" />}
            </Stack>
          </Paper>
        </Box>
      </Fade>

      <Fade in={activeWorkspace === 'results'}>
        <Box sx={{ position: 'absolute', inset: 0, zIndex: 19, pointerEvents: 'none' }}>
          <Paper sx={{ ...workspacePanelSx, width: { xs: 'calc(100% - 32px)', md: 430 }, pointerEvents: activeWorkspace === 'results' ? 'auto' : 'none' }}>
            <Stack spacing={2}>
              <Typography sx={{ color: '#e2e8f0', fontWeight: 800 }}>Analysis Results</Typography>
              {!analysisResult && <Typography sx={{ color: '#94a3b8', fontSize: '0.82rem' }}>Results appear after the heatmap is generated.</Typography>}
              {analysisResult && (
                <>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                    <Metric label="Cells" value={analysisResult.summary.cell_count} />
                    <Metric label="Average" value={Number(analysisResult.summary.average_score).toFixed(1)} />
                    <Metric label="Max" value={Number(analysisResult.summary.max_score).toFixed(1)} />
                  </Box>
                  <Box sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '8px', p: 1.2 }}>
                    <Typography sx={{ color: '#cbd5e1', fontSize: '0.78rem', fontWeight: 800, mb: 0.7 }}>AHP Consistency</Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip label={analysisResult.mcdm?.is_consistent ? 'Consistent' : 'Review'} size="small" sx={{ bgcolor: analysisResult.mcdm?.is_consistent ? 'rgba(34,197,94,0.16)' : 'rgba(245,158,11,0.16)', color: analysisResult.mcdm?.is_consistent ? '#86efac' : '#fbbf24' }} />
                      <Typography sx={{ color: '#94a3b8', fontSize: '0.76rem' }}>CR {Number(analysisResult.mcdm?.consistency_ratio ?? 0).toFixed(3)}</Typography>
                    </Stack>
                  </Box>
                  <Typography sx={{ color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 800 }}>Top Candidate Cells</Typography>
                  <Stack spacing={1}>
                    {analysisResult.top_candidates.map((candidate) => (
                      <Box
                        key={candidate.cell_index}
                        onClick={() => inspectCell(analysisResult.analysis_id, candidate.cell_index)}
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: '42px 1fr auto',
                          gap: 1,
                          alignItems: 'center',
                          bgcolor: 'rgba(255,255,255,0.04)',
                          borderRadius: '8px',
                          p: 1,
                          cursor: 'pointer',
                          border: selectedCellDetail?.cell_index === candidate.cell_index ? '1px solid rgba(34,197,94,0.42)' : '1px solid transparent',
                        }}
                      >
                        <Box sx={{ width: 34, height: 34, borderRadius: '8px', display: 'grid', placeItems: 'center', bgcolor: `${scoreColor(candidate.suitability_score)}22`, color: scoreColor(candidate.suitability_score), fontWeight: 900 }}>{candidate.rank}</Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ color: '#e2e8f0', fontSize: '0.78rem', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>{candidate.cell_index}</Typography>
                          <LinearProgress variant="determinate" value={candidate.suitability_score} sx={{ mt: 0.6, height: 6, borderRadius: '8px', bgcolor: 'rgba(255,255,255,0.08)', '& .MuiLinearProgress-bar': { bgcolor: scoreColor(candidate.suitability_score) } }} />
                        </Box>
                        <Typography sx={{ color: scoreColor(candidate.suitability_score), fontWeight: 900, fontSize: '0.86rem' }}>{candidate.suitability_score.toFixed(1)}</Typography>
                      </Box>
                    ))}
                  </Stack>
                  <Box sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '8px', p: 1.2 }}>
                    <Typography sx={{ color: '#cbd5e1', fontSize: '0.78rem', fontWeight: 800, mb: 0.8 }}>
                      Inspect Cell Details
                    </Typography>
                    {!selectedCellDetail && !selectedCellLoading && (
                      <Typography sx={{ color: '#94a3b8', fontSize: '0.74rem', lineHeight: 1.5 }}>
                        Click any heatmap cell or one of the top candidate rows to inspect its suitability score and criterion contributions.
                      </Typography>
                    )}
                    {selectedCellLoading && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CircularProgress size={16} sx={{ color: '#e17b8f' }} />
                        <Typography sx={{ color: '#94a3b8', fontSize: '0.74rem' }}>Loading cell detail...</Typography>
                      </Box>
                    )}
                    {selectedCellDetail && !selectedCellLoading && (
                      <Stack spacing={1}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'center' }}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ color: '#e2e8f0', fontSize: '0.78rem', fontWeight: 800, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {selectedCellDetail.cell_index}
                            </Typography>
                            <Typography sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                              Rank #{selectedCellDetail.rank ?? 'n/a'} • {scoreClassLabel(selectedCellDetail.score_class)}
                            </Typography>
                          </Box>
                          <Typography sx={{ color: scoreColor(selectedCellDetail.suitability_score), fontWeight: 900, fontSize: '0.92rem' }}>
                            {Number(selectedCellDetail.suitability_score).toFixed(1)}%
                          </Typography>
                        </Box>
                        {readCriteriaBreakdown(selectedCellDetail)?.hard_constraint_violation && (
                          <Alert severity="error" sx={{ fontSize: '0.72rem' }}>
                            NFZ hard constraint triggered. This cell can score well on some criteria but it is still operationally unsafe.
                          </Alert>
                        )}
                        {readCriteriaBreakdown(selectedCellDetail)?.method && (
                          <Typography sx={{ color: '#94a3b8', fontSize: '0.68rem', lineHeight: 1.5 }}>
                            Method: {readCriteriaBreakdown(selectedCellDetail).method}
                            {readCriteriaBreakdown(selectedCellDetail)?.display_score_method
                              ? ` • Display score: ${readCriteriaBreakdown(selectedCellDetail).display_score_method}`
                              : ''}
                          </Typography>
                        )}
                        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
                        <Typography sx={{ color: '#cbd5e1', fontSize: '0.74rem', fontWeight: 800 }}>
                          Criterion impact on this score
                        </Typography>
                        {criterionImpactRows(selectedCellDetail, analysisResult?.mcdm?.priority_vector || weights)
                          .sort((a, b) => b.impact - a.impact)
                          .map((row) => (
                            <Box key={row.key} sx={{ display: 'flex', flexDirection: 'column', gap: 0.3, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '8px', px: 1, py: 0.8 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                                <Typography sx={{ color: '#e2e8f0', fontSize: '0.72rem', fontWeight: 700 }}>
                                  {criteriaLabels[row.key] || row.key}
                                </Typography>
                                <Typography sx={{ color: '#f8fafc', fontSize: '0.72rem', fontWeight: 800 }}>
                                  Impact {Math.round(row.impact * 100)}%
                                </Typography>
                              </Box>
                              <Typography sx={{ color: '#94a3b8', fontSize: '0.68rem' }}>
                                Raw criterion score {Math.round(row.score * 100)}% • Weight {Math.round(row.weight * 100)}%
                              </Typography>
                              {explainCriterionContext(selectedCellDetail, row.key) && (
                                <Typography sx={{ color: '#64748b', fontSize: '0.66rem', lineHeight: 1.45 }}>
                                  {explainCriterionContext(selectedCellDetail, row.key)}
                                </Typography>
                              )}
                            </Box>
                          ))}
                        {readCriteriaBreakdown(selectedCellDetail)?.weighted_priority_score !== undefined && (
                          <Box>
                            <Typography sx={{ color: '#94a3b8', fontSize: '0.68rem', lineHeight: 1.5 }}>
                              Weighted priority score: {(Number(readCriteriaBreakdown(selectedCellDetail).weighted_priority_score) * 100).toFixed(1)}%
                              {readCriteriaBreakdown(selectedCellDetail)?.topsis_closeness !== undefined
                                ? ` • TOPSIS closeness: ${(Number(readCriteriaBreakdown(selectedCellDetail).topsis_closeness) * 100).toFixed(1)}%`
                                : ''}
                            </Typography>
                            {readCriteriaBreakdown(selectedCellDetail)?.topsis_closeness !== undefined
                              && Number(readCriteriaBreakdown(selectedCellDetail).topsis_closeness) <= 0.005
                              && !readCriteriaBreakdown(selectedCellDetail)?.hard_constraint_violation && (
                                <Typography sx={{ color: '#fbbf24', fontSize: '0.66rem', lineHeight: 1.45, mt: 0.4 }}>
                                  TOPSIS is relative to the compared cells. 0% means this cell is currently the least preferred alternative, not missing data.
                                </Typography>
                              )}
                          </Box>
                        )}
                      </Stack>
                    )}
                  </Box>
                  <Box sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '8px', p: 1.2 }}>
                    <Typography sx={{ color: '#cbd5e1', fontSize: '0.78rem', fontWeight: 800, mb: 0.8 }}>
                      Manual Compare
                    </Typography>
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.72rem', lineHeight: 1.5, mb: 1 }}>
                      Select 2 to 3 heatmap cells yourself, then compare them side by side.
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                      <Button
                        variant={compareSelectionMode ? 'contained' : 'outlined'}
                        onClick={() => {
                          setCompareSelectionMode((prev) => !prev);
                          setError('');
                        }}
                        sx={{ borderRadius: '8px', textTransform: 'none' }}
                      >
                        {compareSelectionMode ? 'Stop Selecting' : 'Select Cells on Map'}
                      </Button>
                      <Button
                        variant="text"
                        onClick={() => setSelectedCompareCells([])}
                        disabled={!selectedCompareCells.length}
                        sx={{ color: '#94a3b8', textTransform: 'none' }}
                      >
                        Clear
                      </Button>
                    </Stack>
                    {compareSelectionMode && (
                      <Alert severity="info" sx={{ mb: 1, fontSize: '0.72rem' }}>
                        Click heatmap cells to add or remove them from comparison. Maximum 3 cells.
                      </Alert>
                    )}
                    <Stack spacing={0.8} sx={{ mb: 1 }}>
                      {selectedCompareCells.length === 0 && (
                        <Typography sx={{ color: '#64748b', fontSize: '0.72rem' }}>
                          No cells selected yet.
                        </Typography>
                      )}
                      {selectedCompareCells.map((cell, idx) => (
                        <Box key={`manual-compare-${cell.cell_index}`} sx={{ display: 'grid', gridTemplateColumns: '18px 1fr auto auto', gap: 1, alignItems: 'center', bgcolor: 'rgba(255,255,255,0.03)', p: 0.8, borderRadius: '6px' }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: ['#00ff88', '#00ff00', '#ffff00'][idx] }} />
                          <Tooltip title={cell.cell_index}>
                            <Typography sx={{ color: '#cbd5e1', fontSize: '0.68rem', fontFamily: 'monospace', cursor: 'help', whiteSpace: 'nowrap' }}>
                              {shortCellIndex(cell.cell_index)}
                            </Typography>
                          </Tooltip>
                          <Typography sx={{ color: scoreColor(cell.suitability_score), fontSize: '0.68rem', fontWeight: 900 }}>
                            {cell.suitability_score.toFixed(1)}%
                          </Typography>
                          <Button
                            size="small"
                            onClick={() => setSelectedCompareCells((prev) => prev.filter((item) => item.cell_index !== cell.cell_index))}
                            sx={{ minWidth: 0, px: 0.8, color: '#fca5a5', textTransform: 'none' }}
                          >
                            Remove
                          </Button>
                        </Box>
                      ))}
                    </Stack>
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={compareSelectedCells}
                      disabled={busy === 'compare' || selectedCompareCells.length < 2}
                      sx={{ color: '#e17b8f', borderColor: 'rgba(182,95,112,0.4)', borderRadius: '8px', textTransform: 'none' }}
                    >
                      Compare Selected Cells
                    </Button>
                    {manualCompareResult && renderComparisonCard(manualCompareResult, 'Manual Comparison Results', manualCompareCriteria, setManualCompareCriteria)}
                  </Box>
                  <Button variant="outlined" onClick={compareTopCandidates} disabled={busy === 'compare' || analysisResult.top_candidates.length < 2} sx={{ color: '#e17b8f', borderColor: 'rgba(182,95,112,0.4)', borderRadius: '8px', textTransform: 'none' }}>
                    Compare Top Candidates
                  </Button>
                  {compareResult && renderComparisonCard(compareResult, 'Top Candidate Comparison', compareCriteria, setCompareCriteria)}
                </>
              )}
            </Stack>
          </Paper>
        </Box>
      </Fade>

      <Fade in={activeWorkspace === 'profile'}>
        <Box sx={{ position: 'absolute', inset: 0, zIndex: 19, pointerEvents: 'none' }}>
          <Paper sx={{ ...workspacePanelSx, width: { xs: 'calc(100% - 32px)', md: 430 }, pointerEvents: activeWorkspace === 'profile' ? 'auto' : 'none' }}>
            <Stack spacing={2}>
              <Typography sx={{ color: '#e2e8f0', fontWeight: 800 }}>Saved Analyses</Typography>
              {!!successMessage && <Alert severity="success" onClose={() => setSuccessMessage('')} sx={{ fontSize: '0.76rem' }}>{successMessage}</Alert>}
              {!analysisResult && (
                <Typography sx={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                  Complete an analysis first, then save it to your profile.
                </Typography>
              )}
              {analysisResult && (
                <Box sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '8px', p: 1.2 }}>
                  <Typography sx={{ color: '#cbd5e1', fontSize: '0.78rem', fontWeight: 800, mb: 0.8 }}>
                    Save Analysis to Profile
                  </Typography>
                  <TextField
                    fullWidth
                    label="Saved analysis name"
                    value={saveDraftName}
                    onChange={(event) => setSaveDraftName(event.target.value)}
                    sx={{ ...fieldSx, mb: 1.1 }}
                  />
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="contained"
                      onClick={saveAnalysisToProfile}
                      disabled={busy === 'save'}
                      sx={{ bgcolor: '#b65f70', color: '#fff', borderRadius: '8px', textTransform: 'none', '&:hover': { bgcolor: '#9a4c5a' } }}
                    >
                      {busy === 'save' ? <CircularProgress size={18} color="inherit" /> : 'Save Analysis'}
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={loadSavedHistory}
                      disabled={busy === 'save'}
                      sx={{ color: '#94a3b8', borderColor: 'rgba(148,163,184,0.28)', borderRadius: '8px', textTransform: 'none' }}
                    >
                      Refresh History
                    </Button>
                  </Stack>
                </Box>
              )}
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '8px', p: 1.2 }}>
                <Typography sx={{ color: '#cbd5e1', fontSize: '0.78rem', fontWeight: 800, mb: 0.8 }}>
                  Saved History
                </Typography>
                {!savedHistory.length && (
                  <Typography sx={{ color: '#64748b', fontSize: '0.72rem' }}>
                    No saved analyses in your profile yet.
                  </Typography>
                )}
                <Stack spacing={0.8}>
                  {savedHistory.slice(0, 8).map((item) => (
                    <Box
                      key={`saved-history-${item.analysis_id}`}
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        gap: 1,
                        alignItems: 'center',
                        bgcolor: 'rgba(255,255,255,0.03)',
                        borderRadius: '8px',
                        p: 1,
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ color: '#e2e8f0', fontSize: '0.76rem', fontWeight: 800 }} noWrap>
                          {item.saved_name || item.region_name || `Analysis ${item.analysis_id}`}
                        </Typography>
                        <Typography sx={{ color: '#94a3b8', fontSize: '0.68rem' }}>
                          {new Date(item.saved_at || item.created_at).toLocaleString()} · best {item.suitability_score?.toFixed?.(1) ?? item.suitability_score ?? 'n/a'}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={0.5}>
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => loadSavedAnalysis(item)}
                          disabled={busy === 'history-delete' || busy === 'history'}
                          sx={{ color: '#60a5fa', textTransform: 'none', minWidth: 0 }}
                        >
                          Reload
                        </Button>
                        <Button
                          size="small"
                          variant="text"
                          startIcon={<DeleteOutlineIcon sx={{ fontSize: 15 }} />}
                          onClick={() => deleteSavedAnalysis(item)}
                          disabled={busy === 'history-delete' || busy === 'history'}
                          sx={{ color: '#fca5a5', textTransform: 'none', minWidth: 0 }}
                        >
                          Delete
                        </Button>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Stack>
          </Paper>
        </Box>
      </Fade>

      <Fade in={activeWorkspace === 'exports'}>
        <Box sx={{ position: 'absolute', inset: 0, zIndex: 19, pointerEvents: 'none' }}>
          <Paper sx={{ ...workspacePanelSx, width: { xs: 'calc(100% - 32px)', md: 430 }, pointerEvents: activeWorkspace === 'exports' ? 'auto' : 'none' }}>
            <Stack spacing={2}>
              <Typography sx={{ color: '#e2e8f0', fontWeight: 800 }}>Exported Reports</Typography>
              {!!successMessage && <Alert severity="success" onClose={() => setSuccessMessage('')} sx={{ fontSize: '0.76rem' }}>{successMessage}</Alert>}
              {analysisResult && (
                <Box sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '8px', p: 1.2 }}>
                  <Typography sx={{ color: '#cbd5e1', fontSize: '0.78rem', fontWeight: 800, mb: 0.8 }}>
                    Export Current Analysis
                  </Typography>
                  <Typography sx={{ color: '#94a3b8', fontSize: '0.72rem', lineHeight: 1.5, mb: 1 }}>
                    Generate PDF, CSV, or GeoJSON files for the current analysis. Exported files stay listed here for later download.
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap">
                    <Button
                      variant="outlined"
                      onClick={() => downloadAnalysisExport('pdf')}
                      disabled={busy === 'export'}
                      sx={{ color: '#f8fafc', borderColor: 'rgba(248,250,252,0.18)', borderRadius: '8px', textTransform: 'none' }}
                    >
                      {busy === 'export' ? <CircularProgress size={18} color="inherit" /> : 'Export PDF'}
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => downloadAnalysisExport('csv')}
                      disabled={busy === 'export'}
                      sx={{ color: '#c4b5fd', borderColor: 'rgba(196,181,253,0.3)', borderRadius: '8px', textTransform: 'none' }}
                    >
                      {busy === 'export' ? <CircularProgress size={18} color="inherit" /> : 'Export CSV'}
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => downloadAnalysisExport('geojson')}
                      disabled={busy === 'export'}
                      sx={{ color: '#67e8f9', borderColor: 'rgba(103,232,249,0.28)', borderRadius: '8px', textTransform: 'none' }}
                    >
                      {busy === 'export' ? <CircularProgress size={18} color="inherit" /> : 'Export GeoJSON'}
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={loadExportedReports}
                      disabled={busy === 'export'}
                      sx={{ color: '#94a3b8', borderColor: 'rgba(148,163,184,0.28)', borderRadius: '8px', textTransform: 'none' }}
                    >
                      Refresh Exports
                    </Button>
                  </Stack>
                </Box>
              )}
              {!analysisResult && (
                <Typography sx={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                  Export history is listed here. Run an analysis when you want to generate a new PDF.
                </Typography>
              )}
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '8px', p: 1.2 }}>
                <Typography sx={{ color: '#cbd5e1', fontSize: '0.78rem', fontWeight: 800, mb: 0.8 }}>
                  Export History
                </Typography>
                {!exportedReports.length && (
                  <Typography sx={{ color: '#64748b', fontSize: '0.72rem' }}>
                    No exported reports yet.
                  </Typography>
                )}
                <Stack spacing={0.8}>
                  {exportedReports.slice(0, 12).map((item) => (
                    <Box
                      key={`exported-report-${item.report_id}`}
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: '36px 1fr auto',
                        gap: 1,
                        alignItems: 'center',
                        bgcolor: 'rgba(255,255,255,0.03)',
                        borderRadius: '8px',
                        p: 1,
                      }}
                    >
                      <Box sx={{ width: 32, height: 32, borderRadius: '8px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(225,123,143,0.12)', color: '#fda4af' }}>
                        <DescriptionIcon sx={{ fontSize: 18 }} />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ color: '#e2e8f0', fontSize: '0.75rem', fontWeight: 800 }} noWrap>
                          {item.file_name}
                        </Typography>
                        <Typography sx={{ color: '#94a3b8', fontSize: '0.68rem' }} noWrap>
                          {(item.analysis_name || `Analysis ${item.analysis_id || 'n/a'}`)} · {String(item.format || '').toUpperCase()} · {formatTimestamp(item.created_at)}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={0.5}>
                        <Button
                          size="small"
                          variant="text"
                          startIcon={<DownloadIcon sx={{ fontSize: 15 }} />}
                          onClick={() => downloadExistingReport(item)}
                          disabled={busy === 'report-download' || busy === 'report-delete'}
                          sx={{ color: '#60a5fa', textTransform: 'none', minWidth: 0 }}
                        >
                          Get
                        </Button>
                        <Button
                          size="small"
                          variant="text"
                          startIcon={<DeleteOutlineIcon sx={{ fontSize: 15 }} />}
                          onClick={() => deleteExistingReport(item)}
                          disabled={busy === 'report-delete' || busy === 'report-download'}
                          sx={{ color: '#fca5a5', textTransform: 'none', minWidth: 0 }}
                        >
                          Delete
                        </Button>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Stack>
          </Paper>
        </Box>
      </Fade>

      <Modal open={profileOpen} onClose={() => setProfileOpen(false)}>
        <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
          <Paper sx={{ width: 360, background: 'rgba(2, 6, 23, 0.96)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', p: 2.2 }}>
            <Stack spacing={1.4}>
              <Typography sx={{ color: '#e2e8f0', fontWeight: 800 }}>Profile Settings</Typography>
              <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                {user?.email} · {user?.role}
              </Typography>
              {!!profileMessage && <Alert severity="success" sx={{ fontSize: '0.75rem' }}>{profileMessage}</Alert>}
              <TextField
                fullWidth
                label="Full Name"
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                sx={fieldSx}
              />
              <TextField
                fullWidth
                label="New Password"
                type="password"
                value={profilePassword}
                onChange={(event) => setProfilePassword(event.target.value)}
                helperText="Leave empty to keep current password."
                sx={fieldSx}
              />
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  onClick={saveExpertProfile}
                  disabled={profileSaving}
                  sx={{ bgcolor: '#b65f70', textTransform: 'none', borderRadius: '10px', '&:hover': { bgcolor: '#9a4c5a' } }}
                >
                  {profileSaving ? <CircularProgress size={18} color="inherit" /> : 'Save'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setProfileOpen(false)}
                  sx={{ color: '#94a3b8', borderColor: 'rgba(148,163,184,0.24)', textTransform: 'none', borderRadius: '10px' }}
                >
                  Close
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Box>
      </Modal>

      <Stack sx={{ position: 'absolute', right: 28, top: 108, zIndex: 22, alignItems: 'center' }} spacing={0.9}>
        <Tooltip title={mapControlsOpen ? 'Close map layers' : 'Open map layers'} placement="left">
          <IconButton
            onClick={() => setMapControlsOpen((prev) => !prev)}
            sx={{
              width: 38,
              height: 38,
              bgcolor: '#1d4ed8',
              color: '#eff6ff',
              border: '3px solid rgba(255,255,255,0.92)',
              boxShadow: '0 12px 24px rgba(29,78,216,0.28)',
              '&:hover': { bgcolor: '#1e40af' },
            }}
          >
            <MapIcon />
          </IconButton>
        </Tooltip>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.9,
            maxHeight: mapControlsOpen ? 320 : 0,
            opacity: mapControlsOpen ? 1 : 0,
            transform: `translateY(${mapControlsOpen ? 0 : -8}px)`,
            overflow: 'hidden',
            pointerEvents: mapControlsOpen ? 'auto' : 'none',
            transition: 'max-height 220ms ease, opacity 180ms ease, transform 220ms ease',
          }}
        >
          {[
            { key: 'light', icon: <LightModeIcon fontSize="small" />, label: 'Light mode' },
            { key: 'dark', icon: <DarkModeIcon fontSize="small" />, label: 'Dark mode' },
            { key: 'satellite', icon: <SatelliteAltIcon fontSize="small" />, label: 'Satellite view' },
          ].map((option) => (
            <Tooltip key={option.key} title={option.label} placement="left">
              <IconButton
                onClick={() => {
                  setBaseTone(option.key);
                  setMapControlsOpen(false);
                }}
                sx={{
                  width: 34,
                  height: 34,
                  bgcolor: baseTone === option.key ? '#dbeafe' : 'rgba(255,255,255,0.92)',
                  color: baseTone === option.key ? '#1d4ed8' : '#475569',
                  border: '1px solid rgba(148,163,184,0.18)',
                  boxShadow: '0 8px 18px rgba(15,23,42,0.12)',
                  '&:hover': { bgcolor: '#eff6ff' },
                }}
              >
                {option.icon}
              </IconButton>
            </Tooltip>
          ))}
          <Tooltip title={showBuildings ? `Hide buildings (${buildingLayer?.features?.length ?? 0})` : `Show buildings (${buildingLayer?.features?.length ?? 0})`} placement="left">
            <IconButton
              onClick={() => {
                setShowBuildings((prev) => !prev);
                setMapControlsOpen(false);
              }}
              sx={{
                width: 34,
                height: 34,
                bgcolor: showBuildings ? '#dbeafe' : 'rgba(255,255,255,0.92)',
                color: showBuildings ? '#1d4ed8' : '#475569',
                border: '1px solid rgba(148,163,184,0.18)',
                boxShadow: '0 8px 18px rgba(15,23,42,0.12)',
                '&:hover': { bgcolor: '#eff6ff' },
              }}
            >
              <ApartmentIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={showRoads ? `Hide transport (${roadLayer?.features?.length ?? 0})` : `Show transport (${roadLayer?.features?.length ?? 0})`} placement="left">
            <IconButton
              onClick={() => {
                setShowRoads((prev) => !prev);
                setMapControlsOpen(false);
              }}
              sx={{
                width: 34,
                height: 34,
                bgcolor: showRoads ? '#dbeafe' : 'rgba(255,255,255,0.92)',
                color: showRoads ? '#1d4ed8' : '#475569',
                border: '1px solid rgba(148,163,184,0.18)',
                boxShadow: '0 8px 18px rgba(15,23,42,0.12)',
                '&:hover': { bgcolor: '#eff6ff' },
              }}
            >
              <DirectionsTransitIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={windVisible ? 'Hide Wind Flow' : 'Show Wind Flow'} placement="left">
            <IconButton
              onClick={() => {
                setWindVisible((prev) => !prev);
                setMapControlsOpen(false);
              }}
              sx={{
                width: 34,
                height: 34,
                bgcolor: windVisible ? '#dbeafe' : 'rgba(255,255,255,0.92)',
                color: windVisible ? '#1d4ed8' : '#475569',
                border: '1px solid rgba(148,163,184,0.18)',
                boxShadow: '0 8px 18px rgba(15,23,42,0.12)',
                '&:hover': { bgcolor: '#eff6ff' },
              }}
            >
              <AirIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Stack>

      <Paper sx={{ ...panelSx, position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 20, px: 2, py: 0.8, display: 'flex', gap: 2 }}>
        <Typography sx={{ color: '#94a3b8', fontSize: '0.72rem', fontFamily: 'monospace' }}>LNG {coords.lng.toFixed(4)}</Typography>
        <Typography sx={{ color: '#94a3b8', fontSize: '0.72rem', fontFamily: 'monospace' }}>LAT {coords.lat.toFixed(4)}</Typography>
      </Paper>

      <Paper sx={{ ...panelSx, position: 'absolute', bottom: 78, right: 16, zIndex: 20, p: 1.2, minWidth: 170 }}>
        <Typography sx={{ color: '#cbd5e1', fontSize: '0.7rem', fontWeight: 800, mb: 0.8 }}>Map Layers</Typography>
        {[
          ['NFZ', '#ef4444'],
          ['Controlled', '#3b82f6'],
          ['Suitability', '#22c55e'],
        ].map(([label, color]) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4 }}>
            <Box sx={{ width: 10, height: 10, bgcolor: color, borderRadius: '50%' }} />
            <Typography sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>{label}</Typography>
          </Box>
        ))}
      </Paper>
      <Modal open={jobProgress.open && (busy === 'ingest' || busy === 'analysis' || busy === 'route')} disableAutoFocus>
        <Box sx={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 500, maxWidth: 'calc(100% - 32px)',
          background: 'rgba(2, 6, 23, 0.95)',
          border: '1px solid #e17b8f',
          boxShadow: '0 0 40px rgba(225, 123, 143, 0.2)',
          borderRadius: '12px', overflow: 'hidden'
        }}>
          {/* Header */}
          <Box sx={{ background: '#e17b8f', p: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={16} sx={{ color: '#020617' }} />
            <Typography sx={{ color: '#020617', fontWeight: 900, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              SYSTEM OVERRIDE // {jobProgress.phase}
            </Typography>
          </Box>
          
          {/* Console Body */}
          <Box sx={{ p: 3, fontFamily: 'monospace' }}>
            <Typography sx={{ color: '#e17b8f', fontSize: '0.85rem', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <span style={{ display: 'inline-block', width: 8, height: 16, background: '#e17b8f', animation: 'blink 1s infinite' }} />
              {jobProgress.message}
            </Typography>

            {/* Simulated scrolling logs */}
            <Box sx={{
              height: 80, overflow: 'hidden', position: 'relative',
              '&::after': {
                content: '""', position: 'absolute', inset: 0,
                background: 'linear-gradient(transparent 0%, rgba(2,6,23,1) 90%)',
              }
            }}>
              <Box sx={{
                color: '#64748b', fontSize: '0.7rem', lineHeight: 1.8,
                animation: 'expert-log-scroll 2s linear infinite'
              }}>
                <div>[SYS] Extracting OSM node vectors... OK</div>
                <div>[NET] Bounding box telemetry locked.</div>
                <div>[H3] Generating resolution 8 geometry grids...</div>
                <div>[DB] Fetching building heights from cache.</div>
                <div>[AHP] Applying transport connectivity weights.</div>
                <div>[NFZ] Intersecting geometry against no-fly zones.</div>
              </Box>
            </Box>

            <Box sx={{ mt: 3, position: 'relative' }}>
              <LinearProgress
                variant="determinate"
                value={jobProgress.percent}
                sx={{
                  height: 12, borderRadius: '2px', bgcolor: 'rgba(225,123,143,0.1)',
                  '& .MuiLinearProgress-bar': { bgcolor: '#e17b8f', boxShadow: '0 0 10px #e17b8f' }
                }}
              />
              <Typography sx={{ position: 'absolute', right: 0, top: -20, color: '#e17b8f', fontWeight: 900, fontSize: '0.8rem' }}>
                {jobProgress.percent}%
              </Typography>
            </Box>
          </Box>
          <style>
            {`
              @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
              @keyframes expert-log-scroll { 0% { transform: translateY(0); } 100% { transform: translateY(-30%); } }
            `}
          </style>
        </Box>
      </Modal>

      <Modal open={!!error && !error.includes('warning')} onClose={() => setError('')} disableAutoFocus>
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 420, maxWidth: 'calc(100% - 32px)', ...panelSx, p: 2.4, border: '1px solid rgba(182, 95, 112, 0.6)', boxShadow: '0 10px 40px rgba(182, 95, 112, 0.3)' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Typography sx={{ color: '#b65f70', fontWeight: 900, fontSize: '1.1rem' }}>Analysis Error</Typography>
            <IconButton size="small" onClick={() => setError('')} sx={{ color: '#94a3b8', mt: -0.5, mr: -0.5 }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <Typography sx={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{error}</Typography>
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" onClick={() => setError('')} sx={{ bgcolor: '#b65f70', color: '#fff', '&:hover': { bgcolor: '#9a4c5a' }, textTransform: 'none', borderRadius: '8px' }}>Close</Button>
          </Box>
        </Box>
      </Modal>

      <Modal open={!!error && error.includes('warning')} onClose={() => setError('')} disableAutoFocus>
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 420, maxWidth: 'calc(100% - 32px)', ...panelSx, p: 2.4, border: '1px solid rgba(225, 123, 143, 0.5)', boxShadow: '0 10px 40px rgba(225, 123, 143, 0.2)' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Typography sx={{ color: '#e17b8f', fontWeight: 900, fontSize: '1.1rem' }}>Analysis Warning</Typography>
            <IconButton size="small" onClick={() => setError('')} sx={{ color: '#94a3b8', mt: -0.5, mr: -0.5 }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <Typography sx={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{error}</Typography>
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" onClick={() => setError('')} sx={{ bgcolor: '#e17b8f', color: '#020617', fontWeight: 800, '&:hover': { bgcolor: '#c96a7d' }, textTransform: 'none', borderRadius: '8px' }}>Acknowledge</Button>
          </Box>
        </Box>
      </Modal>
      {hoveredCell && (
        <Paper sx={{
          position: 'absolute',
          left: hoveredCell.point.x + 15,
          top: hoveredCell.point.y - 15,
          zIndex: 100,
          p: 1.5,
          width: 200,
          background: 'rgba(2, 6, 23, 0.95)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(182, 95, 112, 0.3)',
          borderRadius: '12px',
          pointerEvents: 'none',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
        }}>
          <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: '0.8rem', mb: 1 }}>
            Cell {hoveredCell.props.cell_index}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography sx={{ color: '#94a3b8', fontSize: '0.72rem' }}>Total Suitability</Typography>
            <Typography sx={{ color: '#fec287', fontWeight: 900, fontSize: '0.8rem' }}>{Number(hoveredCell.props.suitability_score).toFixed(1)}%</Typography>
          </Box>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', mb: 1 }} />
          {Object.entries(hoveredCell.scores).map(([k, v]) => (
            <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
              <Typography sx={{ color: '#64748b', fontSize: '0.65rem', textTransform: 'capitalize' }}>{k.replace('_', ' ')}</Typography>
              <Typography sx={{ color: '#e2e8f0', fontSize: '0.65rem', fontWeight: 700 }}>{Number(v * 100).toFixed(0)}%</Typography>
            </Box>
          ))}
        </Paper>
      )}

      {analysisResult && (
        <Paper sx={{ ...panelSx, position: 'absolute', bottom: 32, right: 16, width: 220, p: 2, zIndex: 20 }}>
          <Typography sx={{ color: '#e2e8f0', fontWeight: 900, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: 1, mb: 2 }}>
            Suitability Legend
          </Typography>
          <Stack spacing={1.2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 14, height: 14, borderRadius: '3px', bgcolor: '#15803d', boxShadow: '0 0 12px rgba(21,128,61,0.55)' }} />
              <Typography sx={{ color: '#cbd5e1', fontSize: '0.75rem' }}>Best Fit (95+)</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 14, height: 14, borderRadius: '3px', bgcolor: '#22c55e', boxShadow: '0 0 8px rgba(34,197,94,0.45)' }} />
              <Typography sx={{ color: '#cbd5e1', fontSize: '0.75rem' }}>Strong (80+)</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 14, height: 14, borderRadius: '3px', bgcolor: '#f59e0b', boxShadow: '0 0 8px rgba(245,158,11,0.45)' }} />
              <Typography sx={{ color: '#cbd5e1', fontSize: '0.75rem' }}>Moderate (60+)</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 14, height: 14, borderRadius: '3px', bgcolor: '#dc2626' }} />
              <Typography sx={{ color: '#cbd5e1', fontSize: '0.75rem' }}>Low (30+)</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 14, height: 14, borderRadius: '3px', bgcolor: '#7f1d1d', border: '1px solid rgba(255,255,255,0.1)' }} />
              <Typography sx={{ color: '#cbd5e1', fontSize: '0.75rem' }}>Unsuitable / No Data</Typography>
            </Box>
          </Stack>
        </Paper>
      )}
    </Box>
  );
};

const StatusPanel = ({ title, status, rows, warnings = [] }) => (
  <Box sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '8px', p: 1.2 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
      <Typography sx={{ color: '#cbd5e1', fontSize: '0.78rem', fontWeight: 800 }}>{title}</Typography>
      <Chip label={status} size="small" sx={statusChipSx(status)} />
    </Box>
    {rows.map(([label, value]) => (
      <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
        <Typography sx={{ color: '#64748b', fontSize: '0.7rem' }}>{label}</Typography>
        <Typography sx={{ color: '#cbd5e1', fontSize: '0.7rem', fontFamily: typeof value === 'string' && value.length > 12 ? 'monospace' : 'inherit', textAlign: 'right', overflowWrap: 'anywhere' }}>{String(value)}</Typography>
      </Box>
    ))}
    {warnings?.length > 0 && <Alert severity="warning" sx={{ mt: 1, fontSize: '0.72rem' }}>{warnings.slice(0, 2).join(' ')}</Alert>}
  </Box>
);

const CompactWarning = ({ title, items, tone = 'warning' }) => (
  <Box sx={{ bgcolor: tone === 'danger' ? 'rgba(127,29,29,0.28)' : tone === 'success' ? 'rgba(20,83,45,0.28)' : 'rgba(120,53,15,0.28)', border: `1px solid ${tone === 'danger' ? 'rgba(248,113,113,0.25)' : tone === 'success' ? 'rgba(74,222,128,0.25)' : 'rgba(251,191,36,0.25)'}`, borderRadius: '8px', p: 1 }}>
    <Typography sx={{ color: tone === 'danger' ? '#fca5a5' : tone === 'success' ? '#86efac' : '#facc15', fontSize: '0.7rem', fontWeight: 900, mb: 0.6 }}>{title}</Typography>
    {items.slice(0, 3).map((item, index) => (
      <Typography key={`${title}-${index}`} sx={{ color: '#e2e8f0', fontSize: '0.68rem', lineHeight: 1.35, overflowWrap: 'anywhere', mb: 0.35 }}>
        {item}
      </Typography>
    ))}
  </Box>
);

const formatCoord = (value) => Number(value).toFixed(5);

const RoutePointCard = ({ label, point, color }) => (
  <Box sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', p: 1, minWidth: 0 }}>
    <Stack direction="row" spacing={0.7} alignItems="center" sx={{ mb: 0.6 }}>
      <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: color, boxShadow: `0 0 0 4px ${color}22` }} />
      <Typography sx={{ color: '#cbd5e1', fontSize: '0.72rem', fontWeight: 900 }}>{label}</Typography>
    </Stack>
    <Typography sx={{ color: '#e2e8f0', fontSize: '0.72rem', fontWeight: 800, overflowWrap: 'anywhere' }}>{point.name}</Typography>
    <Typography sx={{ color: '#94a3b8', fontSize: '0.64rem', fontFamily: 'monospace', mt: 0.45 }}>
      {formatCoord(point.lat)}, {formatCoord(point.lng)}
    </Typography>
  </Box>
);

const Metric = ({ label, value }) => (
  <Box sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '8px', p: 1, minWidth: 0 }}>
    <Typography sx={{ color: '#64748b', fontSize: '0.62rem', fontWeight: 800 }}>{label.toUpperCase()}</Typography>
    <Typography sx={{ color: '#e2e8f0', fontWeight: 900, fontSize: '1rem' }}>{value}</Typography>
  </Box>
);

export default ExpertAnalysisPage;

