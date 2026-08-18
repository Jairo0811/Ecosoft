import { Box } from '@mui/material';

interface BrandLogoProps {
  maxWidth?: number;
  decorative?: boolean;
}

export function BrandLogo({ maxWidth = 420, decorative = false }: BrandLogoProps) {
  return (
    <Box
      component="img"
      src="/branding/EcoSoft.png"
      alt={decorative ? '' : 'EcoSoft Solutions S.R.L.'}
      aria-hidden={decorative || undefined}
      sx={{
        display: 'block',
        width: '100%',
        maxWidth,
        height: 'auto',
        objectFit: 'contain',
        filter: 'drop-shadow(0 8px 22px rgba(0,108,255,.18))',
      }}
    />
  );
}
