import React, { useState } from 'react';
import { 
  Box, Typography, Button, Paper, Grid, TextField, 
  CircularProgress, Alert, Divider, Tab, Tabs
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import MapIcon from '@mui/icons-material/Map';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import ExpertAnalysisPage from '../components/expert/ExpertAnalysisPage';

const glassCard = {
  background: 'rgba(2, 6, 23, 0.92)',
  backdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '20px',
  p: 4,
  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
};

const inputSx = {
  '& .MuiOutlinedInput-root': {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '8px',
    color: '#e2e8f0',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
    '&.Mui-focused fieldset': { borderColor: '#b65f70' },
  },
  '& .MuiInputLabel-root': { color: '#64748b' },
};

// Kept temporarily while the RAD/SDD-aligned expert workflow is served from ExpertAnalysisPage.
// eslint-disable-next-line no-unused-vars
const ExpertPage = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  
  const [tab, setTab] = useState(0);
  
  // Geodata State
  const [bbox, setBbox] = useState({ min_lat: 40.9, min_lon: 28.8, max_lat: 41.1, max_lon: 29.1 });
  const [gridConfig, setGridConfig] = useState({ center_lat: 41.0, center_lon: 29.0, resolution: 7, radius_km: 10 });
  const [geoResult, setGeoResult] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  
  // Analysis State
  const [analysisConfig, setAnalysisConfig] = useState({ 
    region_id: "ist_core_1", 
    safety: 0.4, 
    noise: 0.3, 
    cost: 0.3 
  });
  const [analysisResult, setAnalysisResult] = useState('');
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleFetchOSM = async () => {
    setGeoLoading(true);
    try {
      const res = await axios.post('/api/geodata/extract-osm', bbox);
      setGeoResult(JSON.stringify(res.data, null, 2));
    } catch (err) {
      setGeoResult(`Error: ${err.response?.data?.detail || err.message}`);
    }
    setGeoLoading(false);
  };

  const handleGenerateGrid = async () => {
    setGeoLoading(true);
    try {
      const res = await axios.post('/api/geodata/generate-grid', gridConfig);
      setGeoResult(JSON.stringify(res.data, null, 2));
    } catch (err) {
      setGeoResult(`Error: ${err.response?.data?.detail || err.message}`);
    }
    setGeoLoading(false);
  };

  const handleRunAnalysis = async () => {
    setAnalysisLoading(true);
    try {
      const payload = {
        region_id: analysisConfig.region_id,
        criteria_weights: {
          safety: parseFloat(analysisConfig.safety),
          noise: parseFloat(analysisConfig.noise),
          cost: parseFloat(analysisConfig.cost)
        }
      };
      const res = await axios.post('/api/analysis/run', payload);
      setAnalysisResult(JSON.stringify(res.data, null, 2));
    } catch (err) {
      setAnalysisResult(`Error: ${err.response?.data?.detail || err.message}`);
    }
    setAnalysisLoading(false);
  };

  return (
    <Box sx={{ minHeight: '100vh', background: '#020617', p: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <AnalyticsIcon sx={{ fontSize: 40, color: '#b65f70' }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#e2e8f0' }}>Expert Analyst Dashboard</Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>Welcome, {user?.full_name || 'Analyst'}</Typography>
          </Box>
        </Box>
        <Button variant="outlined" color="error" onClick={handleLogout} sx={{ borderRadius: 2 }}>
          Logout
        </Button>
      </Box>

      {/* Tabs */}
      <Tabs 
        value={tab} 
        onChange={(e, v) => setTab(v)} 
        sx={{ mb: 4, '& .MuiTab-root': { color: '#64748b', fontWeight: 700 }, '& .Mui-selected': { color: '#b65f70' } }}
      >
        <Tab icon={<MapIcon />} iconPosition="start" label="Geodata Extraction" />
        <Tab icon={<AnalyticsIcon />} iconPosition="start" label="MCDM Analysis" />
      </Tabs>

      {/* Tab 1: Geodata */}
      {tab === 0 && (
        <Grid container spacing={4}>
          <Grid item xs={12} md={6}>
            <Paper sx={glassCard}>
              <Typography variant="h6" sx={{ color: '#e2e8f0', mb: 2 }}>OpenStreetMap Extraction</Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}><TextField fullWidth label="Min Latitude" sx={inputSx} type="number" value={bbox.min_lat} onChange={(e)=>setBbox({...bbox, min_lat: e.target.value})} /></Grid>
                <Grid item xs={6}><TextField fullWidth label="Min Longitude" sx={inputSx} type="number" value={bbox.min_lon} onChange={(e)=>setBbox({...bbox, min_lon: e.target.value})} /></Grid>
                <Grid item xs={6}><TextField fullWidth label="Max Latitude" sx={inputSx} type="number" value={bbox.max_lat} onChange={(e)=>setBbox({...bbox, max_lat: e.target.value})} /></Grid>
                <Grid item xs={6}><TextField fullWidth label="Max Longitude" sx={inputSx} type="number" value={bbox.max_lon} onChange={(e)=>setBbox({...bbox, max_lon: e.target.value})} /></Grid>
              </Grid>
              <Button fullWidth variant="contained" onClick={handleFetchOSM} disabled={geoLoading} sx={{ mt: 3, background: '#b65f70', py: 1.5 }}>
                {geoLoading ? <CircularProgress size={24} color="inherit" /> : 'Fetch Infrastructure from OSM'}
              </Button>
              
              <Divider sx={{ my: 4, borderColor: 'rgba(255,255,255,0.1)' }} />
              
              <Typography variant="h6" sx={{ color: '#e2e8f0', mb: 2 }}>H3 Grid Generation</Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}><TextField fullWidth label="Center Lat" sx={inputSx} type="number" value={gridConfig.center_lat} onChange={(e)=>setGridConfig({...gridConfig, center_lat: e.target.value})} /></Grid>
                <Grid item xs={6}><TextField fullWidth label="Center Lon" sx={inputSx} type="number" value={gridConfig.center_lon} onChange={(e)=>setGridConfig({...gridConfig, center_lon: e.target.value})} /></Grid>
                <Grid item xs={6}><TextField fullWidth label="Resolution" sx={inputSx} type="number" value={gridConfig.resolution} onChange={(e)=>setGridConfig({...gridConfig, resolution: e.target.value})} /></Grid>
                <Grid item xs={6}><TextField fullWidth label="Radius (km)" sx={inputSx} type="number" value={gridConfig.radius_km} onChange={(e)=>setGridConfig({...gridConfig, radius_km: e.target.value})} /></Grid>
              </Grid>
              <Button fullWidth variant="outlined" onClick={handleGenerateGrid} disabled={geoLoading} sx={{ mt: 3, color: '#b65f70', borderColor: '#b65f70', py: 1.5 }}>
                 Generate Cell Grid
              </Button>
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Paper sx={{ ...glassCard, height: '100%', minHeight: 400 }}>
              <Typography variant="h6" sx={{ color: '#e2e8f0', mb: 2 }}>API Output Log</Typography>
              <Box sx={{ 
                background: '#010410', p: 2, borderRadius: 2, height: '80%', 
                overflowY: 'auto', border: '1px solid #1e293b' 
              }}>
                <pre style={{ color: '#10b981', margin: 0, fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                  {geoResult || '// Run an action to see response'}
                </pre>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Tab 2: Analysis */}
      {tab === 1 && (
        <Grid container spacing={4}>
          <Grid item xs={12} md={6}>
            <Paper sx={glassCard}>
              <Typography variant="h6" sx={{ color: '#e2e8f0', mb: 2 }}>Vertiport Placement MCDM</Typography>
              <Alert severity="info" sx={{ mb: 3, background: 'rgba(182,95,112,0.1)', color: '#93c5fd' }}>
                Total weights must equal exactly 1.0 (or 100).
              </Alert>
              <TextField fullWidth label="Region ID" sx={{...inputSx, mb: 3}} value={analysisConfig.region_id} onChange={(e)=>setAnalysisConfig({...analysisConfig, region_id: e.target.value})} />
              
              <Typography variant="subtitle2" sx={{ color: '#94a3b8', mb: 1 }}>Criteria Weights</Typography>
              <Grid container spacing={2}>
                <Grid item xs={4}><TextField fullWidth label="Safety" sx={inputSx} type="number" inputProps={{step:0.1}} value={analysisConfig.safety} onChange={(e)=>setAnalysisConfig({...analysisConfig, safety: e.target.value})} /></Grid>
                <Grid item xs={4}><TextField fullWidth label="Noise" sx={inputSx} type="number" inputProps={{step:0.1}} value={analysisConfig.noise} onChange={(e)=>setAnalysisConfig({...analysisConfig, noise: e.target.value})} /></Grid>
                <Grid item xs={4}><TextField fullWidth label="Cost" sx={inputSx} type="number" inputProps={{step:0.1}} value={analysisConfig.cost} onChange={(e)=>setAnalysisConfig({...analysisConfig, cost: e.target.value})} /></Grid>
              </Grid>
              
              <Button fullWidth variant="contained" onClick={handleRunAnalysis} disabled={analysisLoading} sx={{ mt: 4, background: '#10b981', py: 1.5, '&:hover': { background: '#059669' } }}>
                {analysisLoading ? <CircularProgress size={24} color="inherit" /> : 'Run AHP/TOPSIS Analysis'}
              </Button>
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Paper sx={{ ...glassCard, height: '100%', minHeight: 400 }}>
              <Typography variant="h6" sx={{ color: '#e2e8f0', mb: 2 }}>Analysis Payload JSON</Typography>
              <Box sx={{ 
                background: '#010410', p: 2, borderRadius: 2, height: '80%', 
                overflowY: 'auto', border: '1px solid #1e293b' 
              }}>
                <pre style={{ color: '#b65f70', margin: 0, fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                  {analysisResult || '// Results will appear here'}
                </pre>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default ExpertAnalysisPage;
