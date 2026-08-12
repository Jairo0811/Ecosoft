import { Box } from '@mui/material';

export function BrandLogo({ maxWidth = 420 }: { maxWidth?: number }) {
  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        maxWidth,
        aspectRatio: '1148 / 376',
      }}
    >
      <Box
        component="img"
        src="/branding/logo-horizontal-dark.png"
        alt="EcoSoft Solutions S.R.L."
        sx={{
          display: 'block',
          position: 'absolute',
          width: '133.8%',
          maxWidth: 'none',
          left: '-17.7%',
          top: '-80.6%',
        }}
      />
    </Box>
  );
}
