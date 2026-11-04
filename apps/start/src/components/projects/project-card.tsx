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
import { ProjectChart } from './project-chart';
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
  { key: 'total_screen_views', label: 'Pageviews', unit: '', inverted: false },
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

// The grid card's footer has room for four; the stacked card shows them all.
const GRID_METRIC_KEYS: ProjectMetricKey[] = [
  'unique_visitors',
  'total_sessions',
  'bounce_rate',
  'avg_session_duration',
];
const GRID_METRICS = PROJECT_METRICS.filter((metric) =>
  GRID_METRIC_KEYS.includes(metric.key)
);

// Counts below this read in full in the stacked view ("25,412"), above it compact ("1.2M").
const FULL_NUMBER_LIMIT = 1_000_000;
const STACK_STAT_SKELETON_KEYS = PROJECT_METRICS.map((metric) => metric.key);

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
  return (value: number, unit: ProjectMetric['unit'], compact: boolean) => {
    if (unit === 'currency') {
      return number.currency(value / 100, { short: true });
    }
    if (unit === 'min') {
      return fancyMinutes(value);
    }
    if (unit === '%') {
      return `${number.format(value)}%`;
    }
    if (compact || Math.abs(value) >= FULL_NUMBER_LIMIT) {
      return number.short(value);
    }
    return number.format(value);
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

export function ProjectStackCardSkeleton() {
  return (
    <ProjectCardRoot className="col gap-6 p-6">
      <Skeleton className="h-7 w-1/3" />
      <div className="grid grid-cols-2 gap-6 md:grid-cols-3 xl:grid-cols-6">
        {STACK_STAT_SKELETON_KEYS.map((key) => (
          <div className="col gap-2" key={key}>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>
      <Skeleton className="h-44 w-full" />
    </ProjectCardRoot>
  );
}

function ProjectSettingsButton({
  id,
  organizationId,
  className,
}: {
  id: string;
  organizationId: string;
  className?: string;
}) {
  return (
    <LinkButton
      className={cn('absolute text-muted-foreground', className)}
      href={`/${organizationId}/${id}/settings`}
      variant="ghost"
    >
      <SettingsIcon size={16} />
    </LinkButton>
  );
}

function ProjectCard({ id, domain, name, organizationId }: IServiceProject) {
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
          <ProjectChartOuter id={id} />
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

export function ProjectStackCard({
  id,
  domain,
  name,
  organizationId,
}: IServiceProject) {
  return (
    <ProjectCardRoot>
      <Link
        className="col gap-6 p-6 transition-transform"
        params={{
          organizationId,
          projectId: id,
        }}
        to="/$organizationId/$projectId"
      >
        <div className="row items-center gap-3 pr-10">
          {domain && <SerieIcon name={domain} />}
          <div className="col min-w-0">
            <span className="truncate font-semibold text-xl">{name}</span>
            {domain && (
              <span className="truncate text-muted-foreground text-sm">
                {domain}
              </span>
            )}
          </div>
        </div>
        <ProjectStackStats id={id} />
        <div className="-mx-6 -mb-2 h-44">
          <ProjectChartOuter id={id} />
        </div>
      </Link>
      <ProjectSettingsButton
        className="top-4 right-4"
        id={id}
        organizationId={organizationId}
      />
    </ProjectCardRoot>
  );
}

function ProjectChartOuter({ id }: { id: string }) {
  const { data, interval } = useProjectOverview(id);

  return (
    <FadeIn className="h-full w-full">
      <ProjectChart data={data?.series ?? []} interval={interval} />
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
              metric.unit,
              true
            )}
          />
        ))}
        {hasRevenue && (
          <Metric
            label={REVENUE_METRIC.label}
            value={formatMetric(metrics.total_revenue, 'currency', true)}
          />
        )}
      </div>
    </FadeIn>
  );
}

function StackStat({
  metric,
  metrics,
}: {
  metric: ProjectMetric;
  metrics: ProjectOverviewMetrics | undefined;
}) {
  const formatMetric = useFormatMetric();
  const { current, diff } = metricValues(metrics, metric);

  return (
    <div className="col min-w-0 gap-1">
      <div className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {metric.label}
      </div>
      <div className="truncate font-semibold text-3xl tabular-nums">
        {formatMetric(current, metric.unit, false)}
      </div>
      <div className="row h-5 items-center gap-1 text-muted-foreground text-xs">
        <PreviousDiffIndicatorPure
          {...diff}
          inverted={metric.inverted}
          size="xs"
        />
        {hasChange(diff) && 'vs previous'}
      </div>
    </div>
  );
}

function ProjectStackStats({ id }: { id: string }) {
  const { data } = useProjectOverview(id);
  const metrics = data?.metrics;
  const hasRevenue = !!metrics?.total_revenue;
  const visibleMetrics = PROJECT_METRICS.filter(
    (metric) => metric !== REVENUE_METRIC || hasRevenue
  );

  return (
    <FadeIn
      className={cn(
        'grid grid-cols-2 gap-6 md:grid-cols-3',
        hasRevenue ? 'xl:grid-cols-6' : 'xl:grid-cols-5'
      )}
    >
      {visibleMetrics.map((metric) => (
        <StackStat key={metric.key} metric={metric} metrics={metrics} />
      ))}
    </FadeIn>
  );
}

export default ProjectCard;
