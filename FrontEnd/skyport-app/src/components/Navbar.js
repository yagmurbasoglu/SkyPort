import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Alert, Box, Typography, Button, Chip, IconButton, Tooltip, Modal, Paper, Stack, TextField } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';

import { useAuth } from '../context/AuthContext';
import { getApiErrorMessage } from '../utils/apiError';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, updateProfile } = useAuth();
  const isMap = location.pathname === '/map';
  const showLogout = Boolean(user) && (location.pathname === '/passenger' || location.pathname === '/map');
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [profileName, setProfileName] = React.useState(user?.full_name || '');
  const [profilePassword, setProfilePassword] = React.useState('');
  const [profileSaving, setProfileSaving] = React.useState(false);
  const [profileMessage, setProfileMessage] = React.useState('');
  const [profileError, setProfileError] = React.useState('');

  React.useEffect(() => {
    setProfileName(user?.full_name || '');
  }, [user?.full_name]);

  const handleLogout = () => {
    logout();
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileMessage('');
    setProfileError('');
    try {
      await updateProfile({
        full_name: profileName,
        password: profilePassword || undefined,
      });
      setProfilePassword('');
      setProfileMessage('Profile updated.');
    } catch (error) {
      setProfileError(getApiErrorMessage(error, 'Profile update failed.'));
    } finally {
      setProfileSaving(false);
    }
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
        sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
        onClick={() => navigate('/')}
      >
        <Box
          component="img"
          src="/skyport-logo.png"
          alt="SkyPort Logo"
          sx={{
            height: 48,
            width: 'auto',
            mixBlendMode: 'lighten', // Removes black background
            filter: 'drop-shadow(0 0 10px rgba(182,95,112,0.5))',
            objectFit: 'contain',
            mr: 1,
          }}
        />
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
          <Tooltip title="Profile">
            <IconButton
              onClick={() => setProfileOpen(true)}
              size="small"
              sx={{
                color: '#93c5fd',
                '&:hover': { color: '#dbeafe', background: 'rgba(96,165,250,0.08)' },
              }}
            >
              <PersonOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

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

      <Modal open={profileOpen} onClose={() => setProfileOpen(false)}>
        <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
          <Paper sx={{ width: 360, background: 'rgba(2, 6, 23, 0.96)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', p: 2.2 }}>
            <Stack spacing={1.4}>
              <Typography sx={{ color: '#e2e8f0', fontWeight: 800 }}>Profile Settings</Typography>
              <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                {user?.email} - {user?.role}
              </Typography>
              {!!profileMessage && <Alert severity="success" sx={{ fontSize: '0.75rem' }}>{profileMessage}</Alert>}
              {!!profileError && <Alert severity="error" sx={{ fontSize: '0.75rem' }}>{profileError}</Alert>}
              <TextField
                fullWidth
                label="Full Name"
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': { color: '#e2e8f0', borderRadius: '10px', background: 'rgba(255,255,255,0.04)' },
                  '& .MuiInputLabel-root': { color: '#94a3b8' },
                }}
              />
              <TextField
                fullWidth
                label="New Password"
                type="password"
                value={profilePassword}
                onChange={(event) => setProfilePassword(event.target.value)}
                helperText="Leave empty to keep current password."
                sx={{
                  '& .MuiOutlinedInput-root': { color: '#e2e8f0', borderRadius: '10px', background: 'rgba(255,255,255,0.04)' },
                  '& .MuiInputLabel-root': { color: '#94a3b8' },
                  '& .MuiFormHelperText-root': { color: '#64748b' },
                }}
              />
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  onClick={handleSaveProfile}
                  disabled={profileSaving}
                  sx={{ bgcolor: '#b65f70', textTransform: 'none', borderRadius: '10px', '&:hover': { bgcolor: '#9a4c5a' } }}
                >
                  {profileSaving ? 'Saving...' : 'Save'}
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
    </Box>
  );
};

export default Navbar;

