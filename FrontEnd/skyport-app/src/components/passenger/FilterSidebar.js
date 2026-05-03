import React from 'react';
import {
  Box,
  Chip,
  Divider,
  Paper,
  Slider,
  Typography,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import { FEATURE_ICONS, FEATURE_LABELS } from '../../mock/vertiports';

const FEATURE_KEYS = Object.keys(FEATURE_LABELS);

const FilterSidebar = ({ filters, onChange, resultCount }) => {
  const handleDistanceChange = (_, value) => onChange({ ...filters, maxDistance: value });
  const handleScoreChange = (_, value) => onChange({ ...filters, minScore: value });
  const handlePriceChange = (_, value) => onChange({ ...filters, maxPrice: value });
  const handleFeatureToggle = (key) => onChange({ ...filters, [key]: !filters[key] });

  return (
    <Paper
      sx={{
        position: 'absolute',
        top: '50%',
        left: 24,
        transform: 'translateY(-50%)',
        zIndex: 10,
        pointerEvents: 'auto',
        width: { xs: 'calc(100vw - 48px)', sm: 280 },
        background: 'rgba(2, 6, 23, 0.92)',
        backdropFilter: 'blur(14px)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '14px',
        maxHeight: { xs: 'calc(100vh - 96px)', md: 'calc(100vh - 180px)' },
        overflowY: 'auto',
      }}
    >
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <FilterListIcon sx={{ fontSize: 16, color: '#e17b8f' }} />
        <Typography sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Filters
        </Typography>
        <Chip
          label={`${resultCount} vertiports`}
          size="small"
          sx={{
            ml: 'auto',
            height: 18,
            fontSize: '0.6rem',
            background: 'rgba(225,123,143,0.15)',
            border: '1px solid rgba(225,123,143,0.25)',
            color: '#60a5fa',
          }}
        />
      </Box>

      <Box sx={{ p: 2 }}>
        <Typography sx={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, mb: 0.5 }}>
          Max Distance from Center
        </Typography>
        <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: '#e2e8f0', mb: 1 }}>
          {filters.maxDistance} <span style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 400 }}>km</span>
        </Typography>
        <Slider
          value={filters.maxDistance}
          onChange={handleDistanceChange}
          min={1}
          max={40}
          step={1}
          sx={{
            color: '#e17b8f',
            '& .MuiSlider-track': { background: 'linear-gradient(90deg, #e17b8f, #60a5fa)' },
            '& .MuiSlider-thumb': {
              width: 14,
              height: 14,
              border: '2px solid #e17b8f',
              background: '#fff',
              '&:hover': { boxShadow: '0 0 0 6px rgba(225,123,143,0.2)' },
            },
            '& .MuiSlider-rail': { background: 'rgba(255,255,255,0.1)' },
          }}
        />

        <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.06)' }} />

        <Typography sx={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, mb: 0.5 }}>
          Min Suitability Score
        </Typography>
        <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: '#e2e8f0', mb: 1 }}>
          {filters.minScore} <span style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 400 }}>+</span>
        </Typography>
        <Slider
          value={filters.minScore || 0}
          onChange={handleScoreChange}
          min={0}
          max={100}
          step={5}
          sx={{
            color: '#22c55e',
            '& .MuiSlider-track': { background: 'linear-gradient(90deg, #22c55e, #10b981)' },
            '& .MuiSlider-thumb': {
              width: 14,
              height: 14,
              border: '2px solid #22c55e',
              background: '#fff',
            },
            '& .MuiSlider-rail': { background: 'rgba(255,255,255,0.1)' },
          }}
        />

        <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.06)' }} />

        <Typography sx={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, mb: 0.5 }}>
          Max Estimated Trip Price
        </Typography>
        <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: '#e2e8f0', mb: 1 }}>
          {filters.maxPrice} <span style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 400 }}>TL</span>
        </Typography>
        <Slider
          value={filters.maxPrice || 5000}
          onChange={handlePriceChange}
          min={120}
          max={5000}
          step={50}
          sx={{
            color: '#60a5fa',
            '& .MuiSlider-track': { background: 'linear-gradient(90deg, #60a5fa, #3b82f6)' },
            '& .MuiSlider-thumb': {
              width: 14,
              height: 14,
              border: '2px solid #60a5fa',
              background: '#fff',
            },
            '& .MuiSlider-rail': { background: 'rgba(255,255,255,0.1)' },
          }}
        />

        <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.06)' }} />

        <Typography sx={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, mb: 1.5 }}>
          Station Features
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {FEATURE_KEYS.map((key) => (
            <Box
              key={key}
              onClick={() => handleFeatureToggle(key)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 0.8,
                borderRadius: 1.5,
                cursor: 'pointer',
                transition: 'all 0.15s',
                background: filters[key] ? 'rgba(225,123,143,0.12)' : 'rgba(255,255,255,0.03)',
                border: filters[key] ? '1px solid rgba(225,123,143,0.3)' : '1px solid transparent',
                '&:hover': { background: 'rgba(255,255,255,0.06)' },
              }}
            >
              <Typography sx={{ fontSize: '1rem', lineHeight: 1 }}>{FEATURE_ICONS[key]}</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: filters[key] ? '#60a5fa' : '#94a3b8', flex: 1 }}>
                {FEATURE_LABELS[key]}
              </Typography>
              <Box
                sx={{
                  width: 14,
                  height: 14,
                  borderRadius: '4px',
                  border: filters[key] ? 'none' : '1.5px solid rgba(255,255,255,0.2)',
                  background: filters[key] ? '#e17b8f' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
              >
                {filters[key] && (
                  <Typography sx={{ color: '#fff', fontSize: '0.6rem', lineHeight: 1 }}>✓</Typography>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Paper>
  );
};

export default FilterSidebar;
