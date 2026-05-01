import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Typography, Button, Chip, IconButton, Tooltip } from '@mui/material';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import HomeIcon from '@mui/icons-material/Home';
import LogoutIcon from '@mui/icons-material/Logout';

import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const isMap = location.pathname === '/map';
  const showLogout = Boolean(user) && (location.pathname === '/passenger' || location.pathname === '/map');

  const handleLogout = () => {
    logout();
  };

  return (
    <Box
      component="nav"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 3,
        py: 1.5,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(10, 15, 26, 0.95)',
        backdropFilter: 'blur(10px)',
        zIndex: 100,
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <Box
        sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}
        onClick={() => navigate('/')}
      >
        <Box
          sx={{
            width: 32,
            height: 32,
            background: 'linear-gradient(135deg, #b65f70, #1d4ed8)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(182,95,112,0.4)',
          }}
        >
          <FlightTakeoffIcon sx={{ fontSize: 18, color: '#fff' }} />
        </Box>
        <Typography
          sx={{
            fontWeight: 800,
            fontSize: '1.1rem',
            letterSpacing: '-0.5px',
            background: 'linear-gradient(135deg, #e2e8f0, #94a3b8)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          SKY<span style={{ color: '#b65f70', WebkitTextFillColor: '#b65f70' }}>PORT</span>
        </Typography>
        <Chip
          label="Istanbul UAM"
          size="small"
          sx={{
            height: 20,
            fontSize: '0.62rem',
            background: 'rgba(182,95,112,0.12)',
            border: '1px solid rgba(182,95,112,0.3)',
            color: '#60a5fa',
            letterSpacing: '0.05em',
          }}
        />
      </Box>

      {/* Right side */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mr: 1 }}>
          <Box
            sx={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              bgcolor: '#22c55e',
              boxShadow: '0 0 8px #22c55e',
              animation: 'pulse 2s infinite',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.4 },
              },
            }}
          />
          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.68rem' }}>
            System Online
          </Typography>
        </Box>

        {showLogout && (
          <Tooltip title="Logout">
            <IconButton
              onClick={handleLogout}
              size="small"
              sx={{
                color: '#fca5a5',
                '&:hover': { color: '#fecaca', background: 'rgba(252,165,165,0.08)' },
              }}
            >
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {isMap && (
          <Button
            startIcon={<HomeIcon />}
            onClick={() => navigate('/')}
            size="small"
            sx={{
              color: '#94a3b8',
              textTransform: 'none',
              fontSize: '0.78rem',
              '&:hover': { color: '#e2e8f0', background: 'rgba(255,255,255,0.05)' },
            }}
          >
            Home
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default Navbar;
