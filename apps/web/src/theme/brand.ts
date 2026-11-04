/**
 * EcoSoft design tokens. One source for color, radius, spacing and elevation; the MUI theme
 * (ThemeContext) maps them to components, so pages never hard-code a palette of their own.
 *
 * Palette intent: navy carries structure and primary actions, energy green means positive
 * capacity/success, turquoise marks focus and information, neutrals carry the surfaces. Every
 * text/foreground value below meets WCAG 2.2 AA (≥ 4.5:1) on its surface.
 */
export const brandColors = {
  // Structure (sidebar, headings, primary actions)
  navy950: '#071629',
  navy900: '#0B2240',
  navy800: '#123156',
  navy700: '#13467F', // primary (light mode) — 9.5:1 on white
  blue300: '#82B4FF', // primary (dark mode) — 8.0:1 on dark paper
  // Energy and information
  green700: '#1A7F45', // success / positive (light) — 5.0:1
  green500: '#2BBF5C', // brand green (fills, logo)
  green300: '#5BD08A', // success (dark)
  teal700: '#0A7A8A', // turquoise / info (light) — 5.0:1
  teal400: '#21B5C6', // brand turquoise (fills)
  teal300: '#4FCBD8', // info (dark)
  // Status
  amber700: '#A14A06',
  amber300: '#F2A65A',
  red700: '#B42318',
  red300: '#FF8A80',
  // Neutrals
  ink: '#0E1B2B',
  slate600: '#4B5B6E',
  slate300: '#9FB0C4',
  mist: '#E8EEF5',
  canvas: '#F4F6F8',
  line: '#DDE3EA',
  darkCanvas: '#0A1422',
  darkPaper: '#101D2E',
  white: '#FFFFFF',
} as const;

/**
 * The single brand flourish: a green→turquoise "conductor line" taken from the logo. It is used
 * only for the active navigation indicator and the top edge of the authentication panel.
 */
export const brandGradients = {
  conductor: `linear-gradient(90deg, ${brandColors.green500} 0%, ${brandColors.teal400} 100%)`,
  conductorVertical: `linear-gradient(180deg, ${brandColors.green500} 0%, ${brandColors.teal400} 100%)`,
} as const;

/** Radius by hierarchy: controls < cards < dialogs. */
export const radii = { control: 6, card: 10, dialog: 12 } as const;

/** Elevation is reserved for floating layers (menus, dialogs); surfaces use borders. */
export const elevation = {
  floatingLight: '0 10px 28px rgba(11, 34, 64, 0.14)',
  floatingDark: '0 12px 32px rgba(0, 0, 0, 0.45)',
} as const;

/** Chart series in a fixed order so a technology keeps its color across charts and modes. */
export const chartSeries = {
  light: ['#13467F', '#1A9E52', '#0A8EA0', '#C77700', '#6B4FBB', '#B42318', '#4B5B6E'],
  dark: ['#82B4FF', '#5BD08A', '#4FCBD8', '#F2A65A', '#B9A3FF', '#FF8A80', '#9FB0C4'],
} as const;
