import { Box, Card, CardContent, Chip, Typography } from '@mui/material';
import { ConstructionOutlined } from '@mui/icons-material';

export function ModulePlaceholderPage({ title, phase }: { title: string; phase: number }) {
  return (
    <Box>
      <Typography variant="h3" fontSize={{ xs: 30, sm: 38 }} mb={0.5}>
        {title}
      </Typography>
      <Typography color="text.secondary" mb={3}>
        Módulo previsto en el roadmap de EcoSoft.
      </Typography>
      <Card>
        <CardContent sx={{ p: 5, textAlign: 'center' }}>
          <ConstructionOutlined color="primary" sx={{ fontSize: 56 }} />
          <Typography variant="h5" fontWeight={750} mt={2}>
            Preparado para la Fase {phase}
          </Typography>
          <Typography color="text.secondary" maxWidth={600} mx="auto" my={1.5}>
            La navegación y el límite de módulo ya existen. La lógica se incorporará cuando sus
            reglas e invariantes hayan sido definidas y probadas.
          </Typography>
          <Chip label="Sin datos ficticios persistidos" variant="outlined" color="primary" />
        </CardContent>
      </Card>
    </Box>
  );
}
