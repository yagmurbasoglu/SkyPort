import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#0a0f1a',
      paper: 'rgba(10, 18, 35, 0.92)',
    },
    primary: {
      main: '#3b82f6',
      light: '#60a5fa',
      dark: '#2563eb',
    },
    text: {
      primary: '#e2e8f0',
      secondary: '#94a3b8',
    },
    divider: 'rgba(255,255,255,0.08)',
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
    h6: { fontWeight: 700 },
    subtitle2: { fontWeight: 600, fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase' },
    body2: { fontSize: '0.75rem' },
    caption: { fontSize: '0.7rem' },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.07)',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: 'rgba(59,130,246,0.12)',
          },
        },
      },
    },
    MuiTooltip: {
      defaultProps: { placement: 'right', arrow: true },
      styleOverrides: {
        tooltip: {
          background: '#1e2d4a',
          border: '1px solid rgba(255,255,255,0.1)',
          fontSize: '0.72rem',
          fontFamily: '"Inter", sans-serif',
        },
        arrow: { color: '#1e2d4a' },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: 'rgba(255,255,255,0.07)' },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontFamily: '"Inter", sans-serif',
          fontSize: '0.7rem',
        },
      },
    },
  },
});

export default theme;
