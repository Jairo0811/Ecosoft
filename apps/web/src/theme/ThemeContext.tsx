import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';

interface ThemeModeValue {
  mode: 'light' | 'dark';
  toggleMode: () => void;
}

const ThemeModeContext = createContext<ThemeModeValue | null>(null);

export function EcoSoftThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<'light' | 'dark'>(() =>
    localStorage.getItem('ecosoft_theme') === 'dark' ? 'dark' : 'light',
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
          primary: { main: '#0A5C73', dark: '#073B4C', light: '#2E8396' },
          secondary: { main: '#28A96B', dark: '#1B7B4B' },
          background:
            mode === 'light'
              ? { default: '#F4F7F9', paper: '#FFFFFF' }
              : { default: '#071B24', paper: '#0D2A36' },
        },
        shape: { borderRadius: 12 },
        typography: {
          fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          h1: { fontWeight: 750 },
          h2: { fontWeight: 750 },
          h3: { fontWeight: 700 },
          button: { fontWeight: 700, textTransform: 'none' },
        },
        components: {
          MuiButton: { styleOverrides: { root: { minHeight: 44 } } },
          MuiCard: {
            styleOverrides: {
              root: { boxShadow: mode === 'light' ? '0 8px 28px rgba(7,59,76,.07)' : 'none' },
            },
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
