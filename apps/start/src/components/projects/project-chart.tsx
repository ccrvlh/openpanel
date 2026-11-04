import type { IInterval } from '@openpanel/core/modules/report/report.constants';
import { curveMonotoneX } from 'd3-shape';
import { Area } from '@/components/charts/area';
import { ComposedChart } from '@/components/charts/composed-chart';
import { Line } from '@/components/charts/line';
import { OPChartTooltip } from '@/components/charts/op-tooltip';
import { SeriesBar } from '@/components/charts/series-bar';
import { YAxis } from '@/components/charts/y-axis';
import { useNumber } from '@/hooks/use-numer-formatter';
import type { RouterOutputs } from '@/trpc/client';
import { getChartColor } from '@/utils/theme';

const MARGIN = { top: 10, right: 10, bottom: 10, left: 32 };
const VISITORS_COLOR = getChartColor(0);
const REVENUE_COLOR = '#3ba974';
const REVENUE_AXIS_ID = 'right';
// Revenue bars sit in the lower half so the visitors line stays readable above them.
const REVENUE_HEADROOM = 2;
const REVENUE_MAX_BAR_SIZE = 20;
const VISITORS_MAX_BAR_SIZE = 48;
// Thin bars: a larger radius rounds every corner into a pill.
const BAR_RADIUS = 2;
// The cards are short: a fainter fill reads as a plain line.
const AREA_FILL_OPACITY = 0.4;
const AREA_FILL_BOTTOM_OPACITY = 0.05;
const HOVER_DOT_SIZE = 3;
const HOVER_DOT_HALO_SCALE = 1.8;
const LINE_WIDTH = 2;
const AXIS_TICKS = 2;

const EMPTY_STATE_BARS = [
  28, 42, 35, 50, 40, 56, 45, 60, 49, 32, 98, 29, 49, 69, 49, 20, 28, 42, 35,
  50, 40, 56, 45, 60, 49, 32, 98, 29, 49, 69, 49, 20,
];

export const PROJECT_CHART_TYPES = ['linear', 'area', 'bar'] as const;
export type ProjectChartType = (typeof PROJECT_CHART_TYPES)[number];

export function isProjectChartType(value: string): value is ProjectChartType {
  return PROJECT_CHART_TYPES.some((chartType) => chartType === value);
}

export type ProjectSeriesPoint =
  RouterOutputs['overview']['stats']['series'][number];

interface ChartPoint {
  [key: string]: unknown;
  date: string;
  unique_visitors: number;
  total_revenue: number;
}

// Plain functions, not components: ComposedChart finds its series by the direct child's type.
function visitorsSeries(chartType: ProjectChartType) {
  if (chartType === 'bar') {
    return (
      <SeriesBar
        animate={false}
        dataKey="unique_visitors"
        fill={VISITORS_COLOR}
        radius={BAR_RADIUS}
      />
    );
  }
  if (chartType === 'area') {
    return (
      <Area
        animate={false}
        curve={curveMonotoneX}
        dataKey="unique_visitors"
        fill={VISITORS_COLOR}
        fillOpacity={AREA_FILL_OPACITY}
        gradientToOpacity={AREA_FILL_BOTTOM_OPACITY}
        stroke={VISITORS_COLOR}
        strokeWidth={LINE_WIDTH}
      />
    );
  }
  return (
    <Line
      animate={false}
      curve={curveMonotoneX}
      dataKey="unique_visitors"
      stroke={VISITORS_COLOR}
      strokeWidth={LINE_WIDTH}
    />
  );
}

/** Revenue bars under a line or area; over visitor bars it is a line, so the bars are not split in pairs. */
function revenueSeries(chartType: ProjectChartType) {
  if (chartType === 'bar') {
    return (
      <Line
        animate={false}
        curve={curveMonotoneX}
        dataKey="total_revenue"
        stroke={REVENUE_COLOR}
        strokeWidth={LINE_WIDTH}
        yAxisId={REVENUE_AXIS_ID}
      />
    );
  }
  return (
    <SeriesBar
      animate={false}
      dataKey="total_revenue"
      fill={REVENUE_COLOR}
      radius={BAR_RADIUS}
      yAxisId={REVENUE_AXIS_ID}
    />
  );
}

export function ProjectChart({
  data,
  interval,
  chartType,
}: {
  data: ProjectSeriesPoint[];
  interval: IInterval;
  chartType: ProjectChartType;
}) {
  const number = useNumber();
  if (data.length === 0) {
    return null;
  }
  const points: ChartPoint[] = data.map((point) => ({ ...point }));

  const maxValue = Math.max(...data.map((point) => point.unique_visitors), 0);
  const maxRevenue = Math.max(...data.map((point) => point.total_revenue), 0);
  const hasRevenue = maxRevenue > 0;
  const isBar = chartType === 'bar';

  if (maxValue === 0) {
    return <EmptyState />;
  }

  return (
    <div className="relative h-full w-full pl-3">
      <ComposedChart
        animationDuration={0}
        aspectRatio="auto"
        className="h-full"
        data={points}
        margin={MARGIN}
        maxBarSize={isBar ? VISITORS_MAX_BAR_SIZE : REVENUE_MAX_BAR_SIZE}
        xDataKey="date"
        yDomains={
          hasRevenue
            ? { [REVENUE_AXIS_ID]: [0, maxRevenue * REVENUE_HEADROOM] }
            : undefined
        }
      >
        <YAxis formatValue={number.short} numTicks={AXIS_TICKS} />
        {hasRevenue && revenueSeries(chartType)}
        {visitorsSeries(chartType)}
        <OPChartTooltip<ChartPoint>
          datePill={false}
          dotHaloScale={HOVER_DOT_HALO_SCALE}
          dotSize={HOVER_DOT_SIZE}
          interval={interval}
          rows={(point) => [
            {
              color: VISITORS_COLOR,
              label: 'Visitors',
              value: point.unique_visitors,
              format: number.format,
            },
            ...(point.total_revenue > 0
              ? [
                  {
                    color: REVENUE_COLOR,
                    label: 'Revenue',
                    value: point.total_revenue,
                    unit: 'currency',
                  },
                ]
              : []),
          ]}
          showCrosshair
          showDots={!isBar}
        />
      </ComposedChart>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="relative h-full w-full pl-3">
      <div className="pointer-events-none absolute inset-x-3 bottom-2 h-12">
        <div className="flex h-full items-end gap-1.5 opacity-35">
          {EMPTY_STATE_BARS.map((height, index) => (
            <div
              className="flex-1 rounded-full bg-foreground/20"
              key={`${index}-${height}`}
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-4 text-center">
        <p className="font-medium text-foreground/85 text-sm">
          No activity in this period
        </p>
        <p className="text-muted-foreground text-xs">
          Pick a longer range, or check that tracking is installed.
        </p>
      </div>
    </div>
  );
}
