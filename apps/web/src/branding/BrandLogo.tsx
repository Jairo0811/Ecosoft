import { Box } from '@mui/material';

export function BrandLogo({ maxWidth = 420 }: { maxWidth?: number }) {
  return (
    <Box
      component="img"
      src="/branding/EcoSoft.png"
      alt="EcoSoft Solutions S.R.L."
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
