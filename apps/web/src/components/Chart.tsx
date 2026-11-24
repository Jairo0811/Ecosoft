import { Suspense, lazy, useMemo } from 'react';
import { Skeleton, useTheme } from '@mui/material';
import type { ApexOptions } from 'apexcharts';
import { chartSeries } from '../theme/brand';

/** ApexCharts (~150 kB gzip) is fetched only when a chart is actually rendered. */
const ReactApexChart = lazy(() => import('react-apexcharts'));

type ChartType = 'area' | 'bar' | 'donut' | 'line';

interface ChartProps {
  type: ChartType;
  series: ApexOptions['series'];
  options?: ApexOptions;
  height: number;
  /** Accessible summary of what the chart shows (the SVG itself has no useful semantics). */
  label: string;
}

/** Theme-aware defaults so every chart follows light/dark mode, typography and palette. */
export function Chart({ type, series, options = {}, height, label }: ChartProps) {
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  const merged = useMemo<ApexOptions>(() => {
    const result: ApexOptions = {
      ...options,
      chart: {
        toolbar: { show: false },
        zoom: { enabled: false },
        fontFamily: theme.typography.fontFamily ?? 'inherit',
        foreColor: theme.palette.text.secondary,
        background: 'transparent',
        animations: { enabled: false },
        ...options.chart,
      },
      theme: { mode: dark ? 'dark' : 'light' },
      colors: options.colors ?? [...(dark ? chartSeries.dark : chartSeries.light)],
      grid: { borderColor: theme.palette.divider, strokeDashArray: 3, ...options.grid },
      tooltip: { theme: dark ? 'dark' : 'light', ...options.tooltip },
      legend: {
        fontSize: '13px',
        labels: { colors: theme.palette.text.secondary },
        ...options.legend,
      },
    };
    if (type === 'donut' && !options.stroke) {
      result.stroke = { colors: [theme.palette.background.paper] };
    }
    return result;
  }, [dark, options, theme, type]);
  return (
    <div role="img" aria-label={label}>
      <Suspense fallback={<Skeleton variant="rounded" height={height} aria-hidden />}>
        <ReactApexChart type={type} series={series} options={merged} height={height} />
      </Suspense>
    </div>
  );
}
