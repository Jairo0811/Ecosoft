export const brandColors = {
  navy950: '#020817',
  navy900: '#041126',
  navy850: '#071A31',
  navy800: '#0A2342',
  blue700: '#0047C7',
  blue600: '#006CFF',
  cyan500: '#00B7FF',
  teal500: '#00BFA6',
  green600: '#12A83B',
  green500: '#20C833',
  lime500: '#7ED321',
  white: '#F7FBFF',
} as const;

export const brandGradients = {
  primary: `linear-gradient(135deg, ${brandColors.green500} 0%, ${brandColors.teal500} 42%, ${brandColors.blue600} 100%)`,
  sidebar: `linear-gradient(180deg, ${brandColors.navy950} 0%, ${brandColors.navy900} 58%, #031A38 100%)`,
  hero: `radial-gradient(circle at 16% 18%, rgba(0,183,255,.18), transparent 34%), radial-gradient(circle at 86% 82%, rgba(32,200,51,.16), transparent 30%), linear-gradient(145deg, ${brandColors.navy950} 0%, #03152C 48%, #032143 100%)`,
  card: `linear-gradient(145deg, rgba(7,26,49,.98) 0%, rgba(4,17,38,.98) 100%)`,
} as const;
