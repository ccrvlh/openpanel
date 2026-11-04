import type { IServiceProject } from '@openpanel/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { SettingsIcon } from 'lucide-react';
import { FadeIn } from '../fade-in';
import { useOverviewOptions } from '../overview/useOverviewOptions';
import { PreviousDiffIndicatorPure } from '../report-chart/common/previous-diff-indicator';
import { SerieIcon } from '../report-chart/common/serie-icon';
import { Skeleton } from '../skeleton';
import { LinkButton } from '../ui/button';
import { ProjectChart, type ProjectChartType } from './project-chart';
import { fancyMinutes, useNumber } from '@/hooks/use-numer-formatter';
import { useTRPC } from '@/integrations/trpc/react';
import { cn } from '@/utils/cn';
import { getPreviousMetric } from '@/utils/previous-metric';

const VISITORS_METRIC = {
  key: 'unique_visitors',
  label: 'Visitors',
  unit: '',
  inverted: false,
} as const;
const REVENUE_METRIC = {
  key: 'total_revenue',
  label: 'Revenue',
  unit: 'currency',
  inverted: false,
} as const;

const PROJECT_METRICS = [
  VISITORS_METRIC,
  { key: 'total_sessions', label: 'Sessions', unit: '', inverted: false },
  { key: 'bounce_rate', label: 'Bounce rate', unit: '%', inverted: true },
  {
    key: 'avg_session_duration',
    label: 'Visit duration',
    unit: 'min',
    inverted: false,
  },
  REVENUE_METRIC,
] as const;

type ProjectMetric = (typeof PROJECT_METRICS)[number];
type ProjectMetricKey = ProjectMetric['key'];

// The footer has room for four.
const GRID_METRIC_KEYS: ProjectMetricKey[] = [
  'unique_visitors',
  'total_sessions',
  'bounce_rate',
  'avg_session_duration',
];
const GRID_METRICS = PROJECT_METRICS.filter((metric) =>
  GRID_METRIC_KEYS.includes(metric.key)
);

type ProjectOverviewMetrics = NonNullable<
  ReturnType<typeof useProjectOverview>['data']
>['metrics'];

function useProjectOverview(projectId: string) {
  const trpc = useTRPC();
  const { range, interval, startDate, endDate } = useOverviewOptions();
  const query = useQuery(
    trpc.overview.stats.queryOptions({
      projectId,
      range,
      interval,
      startDate,
      endDate,
      filters: [],
    })
  );
  return { ...query, interval };
}

function useFormatMetric() {
  const number = useNumber();
  return (value: number, unit: ProjectMetric['unit']) => {
    if (unit === 'currency') {
      return number.currency(value / 100, { short: true });
    }
    if (unit === 'min') {
      return fancyMinutes(value);
    }
    if (unit === '%') {
      return `${number.format(value)}%`;
    }
    return number.short(value);
  };
}

function metricValues(
  metrics: ProjectOverviewMetrics | undefined,
  metric: ProjectMetric
) {
  const current = metrics?.[metric.key] ?? 0;
  const previous = metrics?.[`prev_${metric.key}`] ?? null;
  return { current, diff: getPreviousMetric(current, previous) };
}

function hasChange(diff: ReturnType<typeof getPreviousMetric>) {
  return diff?.diff !== null && diff?.diff !== undefined;
}

export function ProjectCardRoot({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'card relative hover:z-10 hover:-translate-y-px hover:shadow-sm',
        className
      )}
    >
      {children}
    </div>
  );
}

export function ProjectCardSkeleton() {
  return (
    <ProjectCardRoot className="col aspect-[340/116.25] p-4">
      <Skeleton className="h-5 w-full" />
      <div className="row mt-auto ml-auto w-1/2 gap-4">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
      </div>
    </ProjectCardRoot>
  );
}

type ProjectCardProps = IServiceProject & { chartType: ProjectChartType };

function ProjectCard({
  id,
  domain,
  name,
  organizationId,
  chartType,
}: ProjectCardProps) {
  return (
    <ProjectCardRoot>
      <Link
        className="col p-4 transition-transform"
        params={{
          organizationId,
          projectId: id,
        }}
        to="/$organizationId/$projectId"
      >
        <div className="flex items-center gap-2 pb-2 font-medium text-lg">
          <div className="row flex-1 gap-2">
            {domain && <SerieIcon name={domain ?? ''} />}
            {name}
          </div>
        </div>
        <div className="-mx-4 mb-4 aspect-[8/1]">
          <ProjectChartOuter chartType={chartType} id={id} />
        </div>
        <div className="flex min-h-4 flex-1 gap-4">
          <ProjectMetrics id={id} />
        </div>
      </Link>
      <ProjectSettingsButton
        className="top-2 right-2"
        id={id}
        organizationId={organizationId}
      />
    </ProjectCardRoot>
  );
}

function ProjectChartOuter({
  id,
  chartType,
}: {
  id: string;
  chartType: ProjectChartType;
}) {
  const { data, interval } = useProjectOverview(id);

  return (
    <FadeIn className="h-full w-full">
      <ProjectChart
        chartType={chartType}
        data={data?.series ?? []}
        interval={interval}
      />
    </FadeIn>
  );
}

function Metric({
  value,
  label,
  className,
}: {
  value: React.ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn('row items-center gap-1 text-sm', className)}>
      <div className="text-muted-foreground">{label}</div>
      <span className="whitespace-nowrap font-medium">{value}</span>
    </div>
  );
}

function ProjectMetrics({ id }: { id: string }) {
  const formatMetric = useFormatMetric();
  const { data } = useProjectOverview(id);
  const metrics = data?.metrics;
  const trend = metricValues(metrics, VISITORS_METRIC);
  const hasRevenue = !!metrics?.total_revenue;

  return (
    <FadeIn className="row flex-1 flex-wrap items-center gap-x-4 gap-y-1">
      {hasChange(trend.diff) && (
        <div className="row items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">{VISITORS_METRIC.label}</span>
          <PreviousDiffIndicatorPure {...trend.diff} size="xs" />
        </div>
      )}
      <div className="row ml-auto flex-wrap gap-x-4 gap-y-1">
        {GRID_METRICS.map((metric) => (
          <Metric
            key={metric.key}
            label={metric.label}
            value={formatMetric(
              metricValues(metrics, metric).current,
              metric.unit
            )}
          />
        ))}
        {hasRevenue && (
          <Metric
            label={REVENUE_METRIC.label}
            value={formatMetric(metrics.total_revenue, 'currency')}
          />
        )}
      </div>
    </FadeIn>
  );
}

export default ProjectCard;
