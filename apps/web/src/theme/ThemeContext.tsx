import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { CssBaseline, ThemeProvider, alpha, createTheme, type Theme } from '@mui/material';
import { esES } from '@mui/material/locale';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans/latin-700.css';
import { brandColors, elevation, radii } from './brand';

type Mode = 'light' | 'dark';

interface ThemeModeValue {
  mode: Mode;
  toggleMode: () => void;
}

const ThemeModeContext = createContext<ThemeModeValue | null>(null);
const STORAGE_KEY = 'ecosoft_theme';

/** Explicit user choice first, then the operating system preference. */
const initialMode = (): Mode => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Storage may be unavailable (private mode, blocked site data).
  }
  return typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
};

export const createEcoSoftTheme = (mode: Mode): Theme => {
  const light = mode === 'light';
  const c = brandColors;
  const primary = light ? c.navy700 : c.blue300;
  const focusRing = light ? c.teal700 : c.teal300;
  const divider = light ? c.line : 'rgba(159, 176, 196, 0.18)';
  const paper = light ? c.white : c.darkPaper;
  const hover = alpha(primary, light ? 0.06 : 0.1);

  return createTheme(
    {
      palette: {
        mode,
        primary: {
          main: primary,
          dark: light ? c.navy900 : '#A9CBFF',
          light: light ? '#2C63A6' : '#5E9BF2',
          contrastText: light ? c.white : c.darkCanvas,
        },
        secondary: {
          main: light ? c.teal700 : c.teal300,
          contrastText: light ? c.white : c.darkCanvas,
        },
        success: {
          main: light ? c.green700 : c.green300,
          contrastText: light ? c.white : c.darkCanvas,
        },
        info: { main: light ? c.teal700 : c.teal300, contrastText: light ? c.white : c.darkCanvas },
        warning: {
          main: light ? c.amber700 : c.amber300,
          contrastText: light ? c.white : c.darkCanvas,
        },
        error: { main: light ? c.red700 : c.red300, contrastText: light ? c.white : c.darkCanvas },
        background: light
          ? { default: c.canvas, paper: c.white }
          : { default: c.darkCanvas, paper: c.darkPaper },
        divider,
        text: light
          ? { primary: c.ink, secondary: c.slate600, disabled: '#8A97A6' }
          : { primary: c.mist, secondary: c.slate300, disabled: '#6B7C90' },
        action: { hover, selected: alpha(primary, light ? 0.1 : 0.16) },
      },
      shape: { borderRadius: radii.control },
      spacing: 8,
      typography: {
        fontFamily:
          '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        fontSize: 14,
        h1: { fontSize: '2.25rem', fontWeight: 600, lineHeight: 1.2, letterSpacing: '-0.01em' },
        h2: { fontSize: '1.875rem', fontWeight: 600, lineHeight: 1.25, letterSpacing: '-0.01em' },
        h3: { fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.3 },
        // Page titles (PageHeader renders h4 as <h1>).
        h4: { fontSize: '1.625rem', fontWeight: 600, lineHeight: 1.25, letterSpacing: '-0.005em' },
        h5: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.35 },
        // Section titles inside cards.
        h6: { fontSize: '1.0625rem', fontWeight: 600, lineHeight: 1.4 },
        subtitle1: { fontWeight: 600 },
        subtitle2: { fontWeight: 600 },
        body1: { fontSize: '0.9375rem', lineHeight: 1.55 },
        body2: { fontSize: '0.875rem', lineHeight: 1.5 },
        caption: { fontSize: '0.78rem', lineHeight: 1.45 },
        overline: { fontSize: '0.75rem', fontWeight: 600, letterSpacing: 0, textTransform: 'none' },
        button: { fontWeight: 600, textTransform: 'none', letterSpacing: 0 },
      },
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            body: { WebkitFontSmoothing: 'antialiased' },
            // Figures align in tables and KPIs.
            'td, .tabular': { fontVariantNumeric: 'tabular-nums' },
            '::selection': { backgroundColor: alpha(focusRing, 0.25) },
            '@media (prefers-reduced-motion: reduce)': {
              '*, *::before, *::after': {
                animationDuration: '0.01ms !important',
                transitionDuration: '0.01ms !important',
              },
            },
          },
        },
        MuiButtonBase: { defaultProps: { disableRipple: false } },
        MuiButton: {
          defaultProps: { disableElevation: true },
          styleOverrides: {
            root: {
              minHeight: 40,
              borderRadius: radii.control,
              paddingInline: 16,
              '&.Mui-focusVisible': { outline: `2px solid ${focusRing}`, outlineOffset: 2 },
            },
            sizeSmall: { minHeight: 32, paddingInline: 10 },
            outlined: { borderColor: light ? '#C3CDD8' : 'rgba(159,176,196,.35)' },
          },
        },
        MuiIconButton: {
          styleOverrides: {
            root: {
              borderRadius: radii.control,
              '&.Mui-focusVisible': { outline: `2px solid ${focusRing}`, outlineOffset: 1 },
            },
          },
        },
        MuiPaper: {
          defaultProps: { elevation: 0 },
          styleOverrides: { root: { backgroundImage: 'none' } },
        },
        MuiCard: {
          defaultProps: { variant: 'outlined' },
          styleOverrides: {
            root: { borderRadius: radii.card, borderColor: divider, backgroundColor: paper },
          },
        },
        MuiCardHeader: {
          styleOverrides: {
            root: { paddingBottom: 8 },
            title: { fontSize: '1.0625rem', fontWeight: 600 },
            subheader: { fontSize: '0.84rem' },
          },
        },
        MuiDialog: {
          styleOverrides: {
            paper: {
              borderRadius: radii.dialog,
              boxShadow: light ? elevation.floatingLight : elevation.floatingDark,
              border: light ? 'none' : `1px solid ${divider}`,
            },
          },
        },
        MuiDialogTitle: { styleOverrides: { root: { fontSize: '1.125rem', fontWeight: 600 } } },
        MuiMenu: {
          styleOverrides: {
            paper: {
              border: `1px solid ${divider}`,
              boxShadow: light ? elevation.floatingLight : elevation.floatingDark,
            },
          },
        },
        MuiPopover: { styleOverrides: { paper: { borderRadius: radii.card } } },
        MuiTooltip: {
          styleOverrides: {
            tooltip: {
              fontSize: '0.78rem',
              backgroundColor: light ? c.navy900 : '#24364D',
              borderRadius: radii.control,
            },
          },
        },
        MuiOutlinedInput: {
          styleOverrides: {
            root: {
              borderRadius: radii.control,
              backgroundColor: light ? c.white : 'rgba(255,255,255,.02)',
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: light ? '#C3CDD8' : 'rgba(159,176,196,.32)',
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: light ? '#8A97A6' : c.slate300,
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: focusRing,
                borderWidth: 2,
              },
            },
          },
        },
        MuiInputLabel: { styleOverrides: { root: { '&.Mui-focused': { color: focusRing } } } },
        MuiChip: {
          styleOverrides: {
            root: { borderRadius: radii.control, fontWeight: 600 },
            sizeSmall: { height: 24, fontSize: '0.75rem' },
          },
        },
        MuiAlert: {
          styleOverrides: { root: { borderRadius: radii.card, alignItems: 'flex-start' } },
        },
        MuiTableHead: {
          styleOverrides: {
            root: {
              '& .MuiTableCell-head': {
                fontWeight: 600,
                fontSize: '0.8rem',
                color: light ? c.slate600 : c.slate300,
                backgroundColor: light ? '#F8FAFC' : 'rgba(255,255,255,.03)',
                whiteSpace: 'nowrap',
              },
            },
          },
        },
        MuiTableCell: {
          styleOverrides: { root: { borderColor: divider, fontVariantNumeric: 'tabular-nums' } },
        },
        MuiTableRow: {
          styleOverrides: { root: { '&.MuiTableRow-hover:hover': { backgroundColor: hover } } },
        },
        MuiTabs: {
          styleOverrides: { indicator: { height: 3, borderRadius: 2, backgroundColor: focusRing } },
        },
        MuiTab: {
          styleOverrides: {
            root: {
              textTransform: 'none',
              fontWeight: 600,
              minHeight: 44,
              '&.Mui-focusVisible': { outline: `2px solid ${focusRing}`, outlineOffset: -2 },
            },
          },
        },
        MuiLink: { styleOverrides: { root: { fontWeight: 500, textUnderlineOffset: 3 } } },
        MuiSkeleton: { styleOverrides: { rounded: { borderRadius: radii.card } } },
        MuiLinearProgress: { styleOverrides: { root: { borderRadius: 4 } } },
      },
    },
    esES,
  );
};

export function EcoSoftThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const value = useMemo(
    () => ({
      mode,
      toggleMode: () =>
        setMode((current) => {
          const next = current === 'light' ? 'dark' : 'light';
          try {
            localStorage.setItem(STORAGE_KEY, next);
          } catch {
            // Preference simply won't persist.
          }
          return next;
        }),
    }),
    [mode],
  );
  const theme = useMemo(() => createEcoSoftTheme(mode), [mode]);
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
