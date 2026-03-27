import React from 'react';
import { Box } from '@mui/material';
import Navbar from '../components/Navbar';
import MapView from '../components/MapView';

const MapPage = () => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        bgcolor: 'background.default',
      }}
    >
      <Navbar />
      <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <MapView />
      </Box>
    </Box>
  );
};

export default MapPage;
