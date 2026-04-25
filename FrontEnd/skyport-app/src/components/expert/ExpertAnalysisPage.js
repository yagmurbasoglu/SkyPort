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
import ApartmentIcon from '@mui/icons-material/Apartment';
import CloseIcon from '@mui/icons-material/Close';
import CropFreeIcon from '@mui/icons-material/CropFree';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DirectionsTransitIcon from '@mui/icons-material/DirectionsTransit';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import FmdGoodIcon from '@mui/icons-material/FmdGood';
import LightModeIcon from '@mui/icons-material/LightMode';
import LogoutIcon from '@mui/icons-material/Logout';
import MapIcon from '@mui/icons-material/Map';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import RouteIcon from '@mui/icons-material/AltRoute';
import SatelliteAltIcon from '@mui/icons-material/SatelliteAlt';
import ScienceIcon from '@mui/icons-material/Science';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
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
import { getMapStyle, hasMapboxToken } from '../../utils/mapStyle';

const ISTANBUL_CENTER = [28.9784, 41.0082];
const ISTANBUL_ZOOM = 9.35;
const ISTANBUL_AIRSPACE_BOUNDS = {
  west: 28.45,
  east: 29.95,
  south: 40.75,
  north: 41.65,
};
const DEFAULT_WEIGHTS = { obstacle: 0.35, transport: 0.25, land_use: 0.2, nfz: 0.2 };
const criteriaLabels = {
  obstacle: 'Obstacle',
  transport: 'Transport',
  land_use: 'Land Use',
  nfz: 'NFZ',
};
const compareDescriptions = {
  total: 'Higher is better. This is the overall AHP/TOPSIS suitability score across all criteria.',
  obstacle: 'Higher is better. A high score means lower obstacle risk and cleaner approach paths.',
  transport: 'Higher is better. A high score means stronger road and transport connectivity around the cell.',
  land_use: 'Higher is better. A high score means the surrounding land use is more suitable for vertiport placement.',
  nfz: 'Higher is better. A high score means the cell is farther from NFZ-related risk. It does not mean the cell is inside an NFZ.',
};
const emptyCollection = { type: 'FeatureCollection', features: [] };
const DEFAULT_EXPERT_ROUTE = {
  fromName: 'Taksim Central Vertiport',
  toName: 'Uskudar Ferry Vertiport',
  maxWindKmh: 35,
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
  '& .MuiInputLabel-root': { color: '#94a3b8' },
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
  if (score >= 75) return '#22c55e';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
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

const ExpertAnalysisPage = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
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
  const [windVisible, setWindVisible] = useState(false);
  const pulseRef = useRef(null);
  const windFrameRef = useRef(null);

  const weightTotal = useMemo(() => Object.values(weights).reduce((sum, value) => sum + Number(value || 0), 0), [weights]);
  const canRunAnalysis = ingestJob?.status === 'success' || ingestJob?.status === 'partial_success';

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
      setMapNotice('OpenStreetMap mode is active. Add a Mapbox token later if you want the dark Mapbox basemap.');
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
        type: 'fill-extrusion',
        source: 'analysis-heatmap',
        paint: {
          'fill-extrusion-color': [
            'interpolate',
            ['linear'],
            ['get', 'suitability_score'],
            0, '#7f1d1d',
            30, '#dc2626',
            60, '#f59e0b',
            80, '#84cc16',
            95, '#22c55e',
            100, '#15803d',
          ],
          'fill-extrusion-height': [
            'interpolate',
            ['linear'],
            ['get', 'suitability_score'],
            0, 0,
            50, 40,
            70, 120,
            100, 350,
          ],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.55,
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
          'circle-color': '#fec287',
          'circle-opacity': ['get', 'opacity'],
          'circle-stroke-width': 0,
        },
      });

      instance.addSource('best-candidate', { type: 'geojson', data: emptyCollection });
      instance.addLayer({
        id: 'best-candidate-flash',
        type: 'fill-extrusion',
        source: 'best-candidate',
        paint: {
          'fill-extrusion-color': '#fec287',
          'fill-extrusion-height': 400,
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': ['get', 'opacity'],
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

      instance.addSource('wind-lines', { type: 'geojson', data: emptyCollection });
      instance.addLayer({
        id: 'wind-lines-layer',
        type: 'line',
        source: 'wind-lines',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#ffffff',
          'line-width': 1.5,
          'line-opacity': 0.15,
          'line-dasharray': [2, 4],
        },
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
    const lines = [];
    for (let lat = bounds.south; lat <= bounds.north; lat += 0.015) {
      lines.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [[bounds.west, lat], [bounds.east, lat]],
        },
      });
    }

    let dashOffset = 0;
    const animateWind = () => {
      dashOffset = (dashOffset + 0.15) % 6;
      if (instance.getLayer('wind-lines-layer')) {
        instance.setPaintProperty('wind-lines-layer', 'line-dasharray', [0.1, dashOffset, 2, 6 - dashOffset]);
      }
      windFrameRef.current = requestAnimationFrame(animateWind);
    };

    instance.getSource('wind-lines')?.setData({ type: 'FeatureCollection', features: lines });
    animateWind();

    return () => {
      if (windFrameRef.current) cancelAnimationFrame(windFrameRef.current);
    };
  }, [mapReady, windVisible]);

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
      const bounds = new mapboxgl.LngLatBounds();
      geojson.features.forEach((feature) => feature.geometry.coordinates[0].forEach((coord) => bounds.extend(coord)));
      map.current.fitBounds(bounds, { padding: 72, duration: 1200, pitch: 45, bearing: -15 });

      // Prepare pulse source for top 3 and beacon for #1
      const top3 = geojson.features
        .filter((f) => f.properties.suitability_score >= 85)
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
      const rank1 = geojson.features.reduce((prev, curr) => 
        (prev.properties.suitability_score > curr.properties.suitability_score) ? prev : curr
      );

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
    map.current.fitBounds(bounds, { padding: 82, duration: 900 });

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
      const percent = response.data.status === 'running'
        ? Math.min(15 + Math.round((attempt / 180) * 70), 92)
        : 100;
      updateProgress({
        phase: 'Geodata Ingest',
        percent,
        message: response.data.status === 'running'
          ? 'OSM, H3, NFZ and controlled airspace layers are being prepared.'
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
      const percent = response.data.status === 'running'
        ? Math.min(72 + Math.round((attempt / 120) * 22), 96)
        : 100;
      updateProgress({
        phase: 'AHP/TOPSIS Analysis',
        percent,
        message: response.data.status === 'running'
          ? 'Suitability scores and heatmap polygons are being calculated.'
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
        map.current.fitBounds(bounds, { padding: 120, duration: 800, pitch: 45, bearing: -15, maxZoom: 14.5 });
      }
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.detail || err.message);
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
      setError(err.response?.data?.message || err.response?.data?.detail || err.message);
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
        setError(err.response?.data?.message || err.response?.data?.detail || err.message);
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
      setError(err.response?.data?.message || err.response?.data?.detail || err.message);
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
      setError(err.response?.data?.message || err.response?.data?.detail || err.message);
    } finally {
      setBusy('');
    }
  };

  const runExpertRouteSafety = async () => {
    setActiveWorkspace('route');
    setBusy('route');
    setError('');
    setRouteResult(null);
    setRouteLayer(null);
    try {
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
          max_wind_kmh: Number(routeForm.maxWindKmh),
        },
      });
      setRouteResult(response.data);
      setRouteLayer(response.data);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.detail || err.message);
    } finally {
      setBusy('');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
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
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: ['#fec287', '#fb8861', '#b6367a'][idx] }} />
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
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: ['#fec287', '#fb8861', '#b6367a'][idx] }} />
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
        <Alert severity="info" sx={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 21, maxWidth: 440, fontSize: '0.76rem', py: 0.5 }}>
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
                  Tune criteria balance for obstacle, transport, land use, and NFZ scoring.
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
                    ['Started', analysis.started_at ? new Date(analysis.started_at).toLocaleTimeString() : 'pending'],
                    ['Completed', analysis.completed_at ? new Date(analysis.completed_at).toLocaleTimeString() : 'pending'],
                  ]}
                />
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
              <TextField label="Max Wind km/h" size="small" type="number" value={routeForm.maxWindKmh} onChange={(event) => setRouteForm((prev) => ({ ...prev, maxWindKmh: event.target.value }))} sx={fieldSx} />
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
                              Rank #{selectedCellDetail.rank ?? 'n/a'} • {selectedCellDetail.score_class}
                            </Typography>
                          </Box>
                          <Typography sx={{ color: scoreColor(selectedCellDetail.suitability_score), fontWeight: 900, fontSize: '0.92rem' }}>
                            {Number(selectedCellDetail.suitability_score).toFixed(1)}%
                          </Typography>
                        </Box>
                        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
                        {Object.entries(readCriteriaScores(selectedCellDetail)).map(([key, value]) => (
                          <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography sx={{ color: '#94a3b8', fontSize: '0.72rem' }}>
                              {criteriaLabels[key] || key}
                            </Typography>
                            <Typography sx={{ color: '#e2e8f0', fontSize: '0.72rem', fontWeight: 800 }}>
                              {Math.round(Number(value || 0) * 100)}%
                            </Typography>
                          </Box>
                        ))}
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
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: ['#fec287', '#fb8861', '#b6367a'][idx] }} />
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
        <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.06)' }} />
        <Button
          fullWidth
          size="small"
          variant={windVisible ? 'contained' : 'outlined'}
          onClick={() => setWindVisible(!windVisible)}
          sx={{
            fontSize: '0.65rem',
            textTransform: 'none',
            borderRadius: '6px',
            bgcolor: windVisible ? 'rgba(182, 95, 112, 0.4)' : 'transparent',
            borderColor: 'rgba(182, 95, 112, 0.3)',
            color: windVisible ? '#fff' : '#94a3b8',
          }}
        >
          {windVisible ? 'Hide Wind Flow' : 'Show Wind Flow'}
        </Button>
      </Paper>
      <Modal open={jobProgress.open && (busy === 'ingest' || busy === 'analysis')} disableAutoFocus>
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 420, maxWidth: 'calc(100% - 32px)', ...panelSx, p: 2.4 }}>
          <Typography sx={{ color: '#e2e8f0', fontWeight: 900, fontSize: '1rem', mb: 0.8 }}>{jobProgress.phase}</Typography>
          <Typography sx={{ color: '#94a3b8', fontSize: '0.82rem', mb: 2 }}>{jobProgress.message}</Typography>
          <LinearProgress
            variant="determinate"
            value={jobProgress.percent}
            sx={{ height: 8, borderRadius: '8px', bgcolor: 'rgba(255,255,255,0.08)', '& .MuiLinearProgress-bar': { bgcolor: '#b65f70' } }}
          />
          <Typography sx={{ color: '#e17b8f', fontWeight: 900, fontSize: '0.86rem', mt: 1, textAlign: 'right' }}>{jobProgress.percent}%</Typography>
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
