import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import {
  FolderPlusIcon,
  LayoutGridIcon,
  type LucideIcon,
  PlusIcon,
  Rows3Icon,
} from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import FullPageLoadingState from '@/components/full-page-loading-state';
import { LazyComponent } from '@/components/lazy-component';
import { OverviewInterval } from '@/components/overview/overview-interval';
import { OverviewRange } from '@/components/overview/overview-range';
import { PageHeader } from '@/components/page-header';
import ProjectCard, {
  ProjectCardSkeleton,
  ProjectStackCard,
  ProjectStackCardSkeleton,
} from '@/components/projects/project-card';
import {
  isProjectChartType,
  PROJECT_CHART_TYPES,
} from '@/components/projects/project-chart';
import { ReportChartType } from '@/components/report/ReportChartType';
import { Button } from '@/components/ui/button';
import { AnimatedSearchInput } from '@/components/ui/data-table/data-table-toolbar';
import { TableButtons } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltiper } from '@/components/ui/tooltip';
import { useCookieStore } from '@/hooks/use-cookie-store';
import { useOrganizationAccess } from '@/hooks/use-organization-access';
import { useSearchQueryState } from '@/hooks/use-search-query-state';
import { useTRPC } from '@/integrations/trpc/react';
import { pushModal } from '@/modals';
import { cn } from '@/utils/cn';
import { createOrganizationTitle, PAGE_TITLES } from '@/utils/title';

const LAZY_CARD_THRESHOLD = 6;

const PROJECT_VIEWS = [
  { value: 'grid', label: 'Grid view', icon: LayoutGridIcon },
  { value: 'stack', label: 'Stacked view', icon: Rows3Icon },
] as const satisfies readonly {
  value: string;
  label: string;
  icon: LucideIcon;
}[];

type ProjectView = (typeof PROJECT_VIEWS)[number]['value'];

function isProjectView(value: string): value is ProjectView {
  return PROJECT_VIEWS.some((view) => view.value === value);
}

export const Route = createFileRoute('/_app/$organizationId/')({
  component: OrganizationPage,
  loader: async ({ context, params }) => {
    await context.queryClient.prefetchQuery(
      context.trpc.project.list.queryOptions({
        organizationId: params.organizationId,
      })
    );
  },
  pendingComponent: FullPageLoadingState,
  head: () => {
    return {
      meta: [
        {
          title: createOrganizationTitle(PAGE_TITLES.PROJECTS),
        },
      ],
    };
  },
});

function OrganizationPage() {
  const { organizationId } = Route.useParams();
  const trpc = useTRPC();
  const { data: projects } = useQuery(
    trpc.project.list.queryOptions({
      organizationId,
    })
  );
  const { isAdmin } = useOrganizationAccess(organizationId);
  const { setSearch, search } = useSearchQueryState();
  const [view, setView] = useCookieStore<ProjectView>('projects-view', 'grid');
  const isStacked = view === 'stack';
  const [storedChartType, setChartType] = useCookieStore<string>(
    'projects-chart-type',
    'linear'
  );
  const chartType = isProjectChartType(storedChartType)
    ? storedChartType
    : 'linear';

  if (!projects?.length) {
    return (
      <div className="container p-8">
        <PageHeader
          className="mb-8"
          description="All your projects in this workspace"
          title="Projects"
        />
        <EmptyState
          description={
            isAdmin
              ? 'A project holds the data for one website or app. Create one, install the SDK, and your first events show up within minutes.'
              : "You don't have access to any projects in this workspace yet. Ask an admin to add you to one."
          }
          icon={FolderPlusIcon}
          title={isAdmin ? 'Create your first project' : 'No projects yet'}
        >
          {isAdmin && (
            <Button icon={PlusIcon} onClick={() => pushModal('AddProject')}>
              Create project
            </Button>
          )}
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="container p-8">
      <PageHeader
        className="mb-8"
        description="All your projects in this workspace"
        title="Projects"
      />

      <TableButtons>
        <OverviewRange />
        <OverviewInterval />
        <ReportChartType
          onChange={(value) => {
            if (isProjectChartType(value)) {
              setChartType(value);
            }
          }}
          types={PROJECT_CHART_TYPES}
          value={chartType}
        />
        <AnimatedSearchInput
          onChange={setSearch}
          placeholder="Search projects"
          value={search}
        />
        <ToggleGroup
          className="ml-auto gap-0 rounded-md border border-input"
          onValueChange={(value) => {
            if (isProjectView(value)) {
              setView(value);
            }
          }}
          size="sm"
          type="single"
          value={view}
        >
          {PROJECT_VIEWS.map(({ value, label, icon: Icon }) => (
            <Tooltiper asChild content={label} key={value}>
              <ToggleGroupItem
                aria-label={label}
                className="first:rounded-r-none last:rounded-l-none"
                value={value}
              >
                <Icon className="size-4" />
              </ToggleGroupItem>
            </Tooltiper>
          ))}
        </ToggleGroup>
      </TableButtons>

      <div
        className={cn(
          'grid gap-6',
          isStacked ? 'grid-cols-1' : 'md:grid-cols-2'
        )}
      >
        {projects
          .filter((project) => {
            if (!search) {
              return true;
            }
            return project.name.toLowerCase().includes(search.toLowerCase());
          })
          .map((project, index) => (
            <LazyComponent
              fallback={
                isStacked ? (
                  <ProjectStackCardSkeleton />
                ) : (
                  <ProjectCardSkeleton />
                )
              }
              key={project.id}
              lazy={index >= LAZY_CARD_THRESHOLD}
            >
              {isStacked ? (
                <ProjectStackCard
                  {...project}
                  chartType={chartType}
                  organizationId={organizationId}
                />
              ) : (
                <ProjectCard
                  {...project}
                  chartType={chartType}
                  organizationId={organizationId}
                />
              )}
            </LazyComponent>
          ))}
      </div>
    </div>
  );
}
