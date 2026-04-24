import React from 'react';
import {
  Box, Paper, Typography, Slider, Divider, Chip,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import { FEATURE_LABELS, FEATURE_ICONS } from '../../mock/vertiports';

const FEATURE_KEYS = Object.keys(FEATURE_LABELS);

const FilterSidebar = ({ filters, onChange, resultCount }) => {
  const handleDistanceChange = (_, value) => onChange({ ...filters, maxDistance: value });
  const handleFeatureToggle = (key) => onChange({ ...filters, [key]: !filters[key] });

  return (
    <Paper
      sx={{
        position: 'absolute',
        top: 72,
        left: 16,
        zIndex: 10,
        width: 240,
        background: 'rgba(2, 6, 23, 0.92)',
        backdropFilter: 'blur(14px)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '14px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <FilterListIcon sx={{ fontSize: 16, color: '#b65f70' }} />
        <Typography sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Filters
        </Typography>
        <Chip
          label={`${resultCount} vertiports`}
          size="small"
          sx={{
            ml: 'auto', height: 18, fontSize: '0.6rem',
            background: 'rgba(182,95,112,0.15)',
            border: '1px solid rgba(182,95,112,0.25)',
            color: '#60a5fa',
          }}
        />
      </Box>

      <Box sx={{ p: 2 }}>
        {/* Distance Slider */}
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
            color: '#b65f70',
            '& .MuiSlider-track': { background: 'linear-gradient(90deg, #b65f70, #60a5fa)' },
            '& .MuiSlider-thumb': {
              width: 14, height: 14,
              border: '2px solid #b65f70',
              background: '#fff',
              '&:hover': { boxShadow: '0 0 0 6px rgba(182,95,112,0.2)' },
            },
            '& .MuiSlider-rail': { background: 'rgba(255,255,255,0.1)' },
          }}
        />

        <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.06)' }} />

        {/* Feature Filters */}
        <Typography sx={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, mb: 1.5 }}>
          Station Features
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {FEATURE_KEYS.map((key) => (
            <Box
              key={key}
              onClick={() => handleFeatureToggle(key)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                px: 1.5, py: 0.8, borderRadius: 1.5, cursor: 'pointer',
                transition: 'all 0.15s',
                background: filters[key] ? 'rgba(182,95,112,0.12)' : 'rgba(255,255,255,0.03)',
                border: filters[key] ? '1px solid rgba(182,95,112,0.3)' : '1px solid transparent',
                '&:hover': { background: 'rgba(255,255,255,0.06)' },
              }}
            >
              <Typography sx={{ fontSize: '1rem', lineHeight: 1 }}>{FEATURE_ICONS[key]}</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: filters[key] ? '#60a5fa' : '#94a3b8', flex: 1 }}>
                {FEATURE_LABELS[key]}
              </Typography>
              <Box
                sx={{
                  width: 14, height: 14, borderRadius: '4px',
                  border: filters[key] ? 'none' : '1.5px solid rgba(255,255,255,0.2)',
                  background: filters[key] ? '#b65f70' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
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
