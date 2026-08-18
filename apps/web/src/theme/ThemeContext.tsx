import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { brandColors, brandGradients } from './brand';

interface ThemeModeValue {
  mode: 'light' | 'dark';
  toggleMode: () => void;
}

const ThemeModeContext = createContext<ThemeModeValue | null>(null);

export function EcoSoftThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<'light' | 'dark'>(() =>
    localStorage.getItem('ecosoft_theme') === 'light' ? 'light' : 'dark',
  );
  const value = useMemo(
    () => ({
      mode,
      toggleMode: () =>
        setMode((current) => {
          const next = current === 'light' ? 'dark' : 'light';
          localStorage.setItem('ecosoft_theme', next);
          return next;
        }),
    }),
    [mode],
  );
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: brandColors.blue600,
            dark: brandColors.blue700,
            light: brandColors.cyan500,
            contrastText: '#FFFFFF',
          },
          secondary: {
            main: brandColors.green500,
            dark: brandColors.green600,
            light: brandColors.lime500,
            contrastText: '#FFFFFF',
          },
          success: { main: brandColors.green500 },
          info: { main: brandColors.cyan500 },
          background:
            mode === 'light'
              ? { default: '#F3F7FD', paper: '#FFFFFF' }
              : { default: brandColors.navy950, paper: brandColors.navy850 },
          divider: mode === 'light' ? 'rgba(0,71,199,.14)' : 'rgba(0,183,255,.18)',
          text:
            mode === 'light'
              ? { primary: '#071A31', secondary: '#52647C' }
              : { primary: brandColors.white, secondary: '#AFC1D8' },
        },
        shape: { borderRadius: 14 },
        typography: {
          fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          h1: { fontWeight: 750 },
          h2: { fontWeight: 750 },
          h3: { fontWeight: 750 },
          button: { fontWeight: 700, textTransform: 'none' },
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: { minHeight: 44, borderRadius: 10 },
              containedPrimary: {
                backgroundImage: brandGradients.primary,
                boxShadow: '0 10px 24px rgba(0,108,255,.22)',
                '&:hover': {
                  backgroundImage: brandGradients.primary,
                  boxShadow: '0 12px 28px rgba(0,108,255,.32)',
                  filter: 'brightness(1.05)',
                },
              },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: {
                border: `1px solid ${
                  mode === 'light' ? 'rgba(0,71,199,.12)' : 'rgba(0,183,255,.18)'
                }`,
                backgroundImage: mode === 'dark' ? brandGradients.card : 'none',
                boxShadow:
                  mode === 'light'
                    ? '0 10px 30px rgba(0,71,199,.08)'
                    : '0 12px 34px rgba(0,0,0,.22)',
              },
            },
          },
          MuiOutlinedInput: {
            styleOverrides: {
              root: {
                transition: 'box-shadow .2s ease, border-color .2s ease',
                '&.Mui-focused': {
                  boxShadow: `0 0 0 3px ${
                    mode === 'light' ? 'rgba(0,108,255,.10)' : 'rgba(0,183,255,.12)'
                  }`,
                },
              },
            },
          },
          MuiChip: {
            styleOverrides: { root: { fontWeight: 700 } },
          },
        },
      }),
    [mode],
  );
  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode(): ThemeModeValue {
  const context = useContext(ThemeModeContext);
  if (!context) throw new Error('useThemeMode debe utilizarse dentro de EcoSoftThemeProvider.');
  return context;
}
