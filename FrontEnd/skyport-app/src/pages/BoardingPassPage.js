import React from 'react';
import { Box, Chip, Divider, Paper, Typography } from '@mui/material';
import FlightIcon from '@mui/icons-material/Flight';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import { useSearchParams } from 'react-router-dom';

const BoardingPassPage = () => {
  const [searchParams] = useSearchParams();
  const flight = searchParams.get('flight') || 'Unavailable';
  const gate = searchParams.get('gate') || 'TBD';
  const from = searchParams.get('from') || 'Origin';
  const to = searchParams.get('to') || 'Destination';
  const distance = searchParams.get('distance') || '-';
  const duration = searchParams.get('duration') || '-';
  const price = searchParams.get('price') || '-';
  const issuedAt = searchParams.get('issued_at') || 'Unknown';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        px: 2,
        py: 4,
        background:
          'radial-gradient(circle at top, rgba(225,123,143,0.18), transparent 32%), linear-gradient(180deg, #020617 0%, #0f172a 100%)',
      }}
    >
      <Paper
        sx={{
          width: '100%',
          maxWidth: 420,
          overflow: 'hidden',
          borderRadius: '28px',
          border: '1px solid rgba(225,123,143,0.24)',
          background: 'rgba(15, 23, 42, 0.96)',
          boxShadow: '0 28px 80px rgba(0,0,0,0.55)',
        }}
      >
        <Box sx={{ p: 3, background: 'linear-gradient(135deg, #e17b8f, #be123c)', position: 'relative' }}>
          <Chip
            icon={<QrCode2Icon sx={{ color: '#fff !important' }} />}
            label="Live Boarding Pass"
            size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: '#fff', fontWeight: 700 }}
          />
          <Typography sx={{ color: '#fff', fontSize: '1.55rem', fontWeight: 900, mt: 1.2 }}>
            {flight}
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.82)', fontSize: '0.8rem', mt: 0.4 }}>
            Gate {gate} • Issued {issuedAt}
          </Typography>
          <FlightIcon sx={{ position: 'absolute', right: 18, bottom: -10, fontSize: 84, color: 'rgba(255,255,255,0.08)', transform: 'rotate(45deg)' }} />
        </Box>

        <Box sx={{ px: 3, pt: 3, pb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <RouteColumn label="From" value={from} align="left" />
            <FlightIcon sx={{ color: '#e17b8f', opacity: 0.55, transform: 'rotate(90deg)', flexShrink: 0 }} />
            <RouteColumn label="To" value={to} align="right" />
          </Box>

          <Divider sx={{ my: 2.5, borderColor: 'rgba(255,255,255,0.07)', borderStyle: 'dashed' }} />

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1.2 }}>
            <MetricCard label="Distance" value={`${distance} km`} />
            <MetricCard label="Duration" value={`${duration} min`} />
            <MetricCard label="Price" value={`₺${price}`} />
          </Box>

          <Box sx={{ mt: 2.2, display: 'flex', alignItems: 'center', gap: 1.2, p: 1.3, borderRadius: '12px', bgcolor: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <WorkspacePremiumIcon sx={{ color: '#4ade80', fontSize: 18 }} />
            <Typography sx={{ color: '#86efac', fontSize: '0.76rem', fontWeight: 700 }}>
              Verified live passenger card
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

const RouteColumn = ({ label, value, align }) => (
  <Box sx={{ flex: 1, minWidth: 0, textAlign: align }}>
    <Typography sx={{ fontSize: '0.64rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
      {label}
    </Typography>
    <Typography sx={{ fontSize: '0.92rem', color: '#e2e8f0', fontWeight: 800 }} noWrap>
      {value}
    </Typography>
  </Box>
);

const MetricCard = ({ label, value }) => (
  <Box sx={{ borderRadius: '12px', p: 1.1, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
    <Typography sx={{ fontSize: '0.62rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
      {label}
    </Typography>
    <Typography sx={{ fontSize: '0.82rem', color: '#e2e8f0', fontWeight: 800, mt: 0.3 }}>
      {value}
    </Typography>
  </Box>
);

export default BoardingPassPage;
