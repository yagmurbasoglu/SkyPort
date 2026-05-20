import React from 'react';
import { Box, Divider, Paper, Typography } from '@mui/material';
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
  const departureDate = searchParams.get('departure_date') || '-';
  const departureTime = searchParams.get('departure_time') || '-';
  const passengers = searchParams.get('passengers') || '1';

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
        <Box sx={{ p: 3.2, background: 'linear-gradient(135deg, #e17b8f, #be123c)', position: 'relative' }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.8,
              px: 1.15,
              py: 0.7,
              borderRadius: '999px',
              bgcolor: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff',
              fontSize: '0.76rem',
              fontWeight: 800,
              lineHeight: 1.1,
            }}
          >
            <QrCode2Icon sx={{ fontSize: 15, color: '#fff' }} />
            <Box component="span">Live Boarding Pass</Box>
          </Box>
          <Typography sx={{ color: '#fff', fontSize: '1.55rem', fontWeight: 900, mt: 1.2 }}>
            {flight}
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.82)', fontSize: '0.8rem', mt: 0.4 }}>
            Gate {gate} - Issued {issuedAt}
          </Typography>
          <FlightIcon sx={{ position: 'absolute', right: 18, bottom: -10, fontSize: 84, color: 'rgba(255,255,255,0.08)', transform: 'rotate(45deg)' }} />
        </Box>

        <Box sx={{ px: 3.2, pt: 3.2, pb: 2.4 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 56px minmax(0, 1fr)', alignItems: 'center', gap: 1.4 }}>
            <RouteColumn label="From" value={from} align="left" />
            <Box sx={{ display: 'grid', placeItems: 'center' }}>
              <FlightIcon sx={{ color: '#e17b8f', opacity: 0.55, transform: 'rotate(90deg)', flexShrink: 0, fontSize: 28 }} />
            </Box>
            <RouteColumn label="To" value={to} align="right" />
          </Box>

          <Divider sx={{ my: 2.5, borderColor: 'rgba(255,255,255,0.07)', borderStyle: 'dashed' }} />

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1.2 }}>
            <MetricCard label="Distance" value={`${distance} km`} />
            <MetricCard label="Duration" value={`${duration} min`} />
            <MetricCard label="Price" value={`TL ${price}`} />
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.2, mt: 1.2 }}>
            <MetricCard label="Date" value={departureDate} />
            <MetricCard label="Time" value={departureTime} />
            <MetricCard label="Passengers" value={passengers} />
            <MetricCard label="Booking Rule" value="Max 2 pax" />
          </Box>

          <Box sx={{ mt: 2.2, display: 'flex', alignItems: 'center', gap: 1.2, p: 1.3, borderRadius: '12px', bgcolor: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <WorkspacePremiumIcon sx={{ color: '#4ade80', fontSize: 18 }} />
            <Typography sx={{ color: '#86efac', fontSize: '0.76rem', fontWeight: 700 }}>
              Verified live passenger card - passenger limit is 2
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

const RouteColumn = ({ label, value, align }) => (
  <Box sx={{ minWidth: 0, textAlign: align }}>
    <Typography sx={{ fontSize: '0.64rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1.2 }}>
      {label}
    </Typography>
    <Typography
      sx={{
        fontSize: '0.9rem',
        color: '#e2e8f0',
        fontWeight: 800,
        lineHeight: 1.24,
        mt: 0.38,
        minHeight: 44,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        overflowWrap: 'anywhere',
      }}
    >
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
