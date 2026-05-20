import React from 'react';
import { Box, Paper, Typography, IconButton, Tooltip, Chip, Divider } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import { FEATURE_ICONS } from '../../mock/vertiports';

const FavoritesSidebar = ({ favorites, vertiports = [], onToggle, onFlyTo }) => {
  const favoriteMeta = new Map((favorites || []).map((item) => [item.vertiport_id, item]));
  const favoriteVertiports = vertiports
    .filter((vp) => favoriteMeta.has(vp.id))
    .map((vp) => ({ ...vp, favoriteLabel: favoriteMeta.get(vp.id)?.label || 'standard' }));

  return (
    <Paper
      sx={{
        position: 'absolute',
        top: '50%',
        right: 24,
        transform: 'translateY(-50%)',
        zIndex: 10,
        width: 250,
        background: 'rgba(2, 6, 23, 0.92)',
        backdropFilter: 'blur(14px)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '14px',
        overflow: 'hidden',
        maxHeight: 'calc(100vh - 180px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <StarIcon sx={{ fontSize: 16, color: '#f59e0b' }} />
        <Typography sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Favorites
        </Typography>
        <Chip
          label={favoriteVertiports.length}
          size="small"
          sx={{
            ml: 'auto', height: 18, fontSize: '0.62rem', minWidth: 24,
            background: 'rgba(245,158,11,0.15)',
            border: '1px solid rgba(245,158,11,0.25)',
            color: '#f59e0b',
          }}
        />
      </Box>
      <Box sx={{ px: 2, pt: 1.1, pb: 0.6, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <Typography sx={{ fontSize: '0.68rem', color: '#64748b', lineHeight: 1.5 }}>
          Home marks a regular takeoff point. Work marks a frequent destination for faster recognition later.
        </Typography>
      </Box>

      {/* List */}
      <Box sx={{ overflowY: 'auto', flex: 1, py: 1 }}>
        {favoriteVertiports.length === 0 ? (
          <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
            <StarBorderIcon sx={{ fontSize: 32, color: '#1e2d4a', mb: 1 }} />
            <Typography sx={{ fontSize: '0.78rem', color: '#334155' }}>
              No favorites yet.
            </Typography>
            <Typography sx={{ fontSize: '0.7rem', color: '#1e2d4a', mt: 0.5 }}>
              Click the star on a vertiport to save it here.
            </Typography>
          </Box>
        ) : (
          favoriteVertiports.map((vp, i) => (
            <React.Fragment key={vp.id}>
              <Box
                sx={{
                  px: 2, py: 1.2,
                  display: 'flex', alignItems: 'flex-start', gap: 1.5,
                  transition: 'background 0.15s',
                  '&:hover': { background: 'rgba(255,255,255,0.03)' },
                }}
              >
                {/* Score badge */}
                <Box
                  sx={{
                    width: 34, height: 34, borderRadius: '8px', flexShrink: 0,
                    background: `linear-gradient(135deg, ${scoreColor(vp.suitabilityScore)}22, ${scoreColor(vp.suitabilityScore)}44)`,
                    border: `1px solid ${scoreColor(vp.suitabilityScore)}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: scoreColor(vp.suitabilityScore) }}>
                    {vp.suitabilityScore}
                  </Typography>
                </Box>

                {/* Info */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1', lineHeight: 1.3, mb: 0.4 }} noWrap>
                    {vp.name}
                  </Typography>
                  {vp.favoriteLabel && vp.favoriteLabel !== 'standard' && (
                    <Chip
                      label={vp.favoriteLabel === 'home' ? 'Home' : 'Work'}
                      size="small"
                      sx={{
                        mb: 0.45,
                        height: 18,
                        fontSize: '0.6rem',
                        bgcolor: vp.favoriteLabel === 'home' ? 'rgba(96,165,250,0.14)' : 'rgba(52,211,153,0.14)',
                        color: vp.favoriteLabel === 'home' ? '#93c5fd' : '#6ee7b7',
                      }}
                    />
                  )}
                  {vp.reviewCount > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: 0.45 }}>
                      <ReviewStars averageRating={vp.averageRating} />
                      <Typography sx={{ fontSize: '0.64rem', color: '#94a3b8' }}>
                        {Number(vp.averageRating).toFixed(1)} · {vp.reviewCount}
                      </Typography>
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4 }}>
                    {vp.features.slice(0, 2).map((f) => (
                      <Typography key={f} sx={{ fontSize: '0.68rem', color: '#475569' }}>
                        {FEATURE_ICONS[f]}
                      </Typography>
                    ))}
                    <Typography sx={{ fontSize: '0.68rem', color: '#334155' }}>
                      {vp.distanceFromCenter} km
                    </Typography>
                  </Box>
                </Box>

                {/* Actions */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3, flexShrink: 0 }}>
                  <Tooltip title="Fly to">
                    <IconButton
                      size="small"
                      onClick={() => onFlyTo && onFlyTo(vp)}
                      sx={{ width: 24, height: 24, color: '#475569', '&:hover': { color: '#60a5fa' } }}
                    >
                      <MyLocationIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                    <Tooltip title="Remove from favorites">
                      <IconButton
                        size="small"
                        onClick={() => onToggle(vp.id, vp.favoriteLabel || 'standard')}
                        sx={{ width: 24, height: 24, color: '#f59e0b', '&:hover': { color: '#ef4444' } }}
                      >
                        <StarIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
              {i < favoriteVertiports.length - 1 && (
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)', mx: 2 }} />
              )}
            </React.Fragment>
          ))
        )}
      </Box>
    </Paper>
  );
};

const scoreColor = (score) => {
  if (score >= 85) return '#22c55e';
  if (score >= 70) return '#eab308';
  return '#ef4444';
};

const ReviewStars = ({ averageRating = 0 }) => {
  const width = Math.max(0, Math.min((Number(averageRating || 0) / 5) * 100, 100));

  return (
    <Box sx={{ position: 'relative', width: 52, height: 12, display: 'inline-flex' }}>
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', color: '#334155' }}>
        {[0, 1, 2, 3, 4].map((item) => (
          <StarIcon key={`favorite-star-bg-${item}`} sx={{ fontSize: 12 }} />
        ))}
      </Box>
      <Box sx={{ position: 'absolute', inset: 0, width: `${width}%`, overflow: 'hidden', display: 'flex', color: '#f59e0b' }}>
        {[0, 1, 2, 3, 4].map((item) => (
          <StarIcon key={`favorite-star-fill-${item}`} sx={{ fontSize: 12 }} />
        ))}
      </Box>
    </Box>
  );
};

export default FavoritesSidebar;

