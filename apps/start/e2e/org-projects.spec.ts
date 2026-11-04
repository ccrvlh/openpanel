import { expect, test } from './fixtures';
import {
  apiFailures,
  dismissFeedbackPrompt,
  expectNoCrashes,
  gotoHydrated,
  shot,
  trpcQuery,
  watchProblems,
} from './org-helpers';

const LAZY_FROM_INDEX = 6;
const MOBILE_VIEWPORT = { width: 390, height: 844 };
// The shared dev server takes 10-25s per navigation while other suites run.
const SLOW_DEV_SERVER_TIMEOUT_MS = 150_000;

test.setTimeout(SLOW_DEV_SERVER_TIMEOUT_MS);

interface ProjectListItem {
  id: string;
  name: string;
}

interface ProjectStats {
  metrics: {
    unique_visitors: number;
    total_sessions: number;
    total_revenue: number;
  };
}

// The cards read `overview.stats` for the page's range; asking for the same
// range and interval gives the numbers they show.
const RANGE = '30d';
const INTERVAL = 'day';

const statsInput = (projectId: string) => ({
  projectId,
  range: RANGE,
  interval: INTERVAL,
  startDate: null,
  endDate: null,
  filters: [],
});

const full = new Intl.NumberFormat('en-US');
const compact = (value: number) =>
  new Intl.NumberFormat('en-US', { notation: 'compact' }).format(value);

test.beforeEach(async ({ page }) => {
  await dismissFeedbackPrompt(page);
});

test('project cards show the numbers the API returns', async ({
  page,
  seed,
}) => {
  const problems = watchProblems(page);
  await gotoHydrated(page, `/${seed.organizationId}?range=${RANGE}`);

  for (const project of seed.projects) {
    const data = await trpcQuery<ProjectStats>(
      page,
      'overview.stats',
      statsInput(project.id)
    );
    const card = page.locator('.card', {
      has: page.locator(`a[href="/${seed.organizationId}/${project.id}"]`),
    });
    await expect(card).toContainText(project.name);
    await expect(card).toContainText(
      `Visitors${compact(data.metrics.unique_visitors)}`
    );
    await expect(card).toContainText(
      `Sessions${compact(data.metrics.total_sessions)}`
    );
    await expect(card).toContainText('Bounce rate');
    await expect(card).toContainText('Visit duration');
    await expect(card.locator('svg.overflow-visible').first()).toBeVisible();
    if (data.metrics.total_revenue > 0) {
      await expect(card).toContainText('Revenue');
    }
  }
  await shot(page, 'projects');
  expectNoCrashes(problems);
  expect(apiFailures(problems)).toEqual([]);
});

test('a card links to the project and its cog opens project settings', async ({
  page,
  seed,
}) => {
  await gotoHydrated(page, `/${seed.organizationId}`);
  const card = page.locator('.card', { hasText: 'Acme Shop' });
  await card.locator('a').nth(1).click();
  await expect(page).toHaveURL(/\/acme\/acme-shop\/settings/);

  await page.goBack();
  await card.locator('a').first().click();
  await expect(page).toHaveURL(/\/acme\/acme-shop$/);
});

// Open defect: LinkButton passes `href` to TanStack's <Link>, which renders the
// current location instead. Open-in-new-tab and copy-link go to /acme.
test('the cog on a card carries the project settings href', async ({
  page,
  seed,
}) => {
  await gotoHydrated(page, `/${seed.organizationId}`);
  const cog = page
    .locator('.card', { hasText: 'Acme Shop' })
    .locator('a')
    .nth(1);
  await expect(cog).toHaveAttribute(
    'href',
    `/${seed.organizationId}/acme-shop/settings`
  );
});

test('search filters cards, lives in the URL and survives a reload', async ({
  page,
  seed,
}) => {
  await gotoHydrated(page, `/${seed.organizationId}`);
  const search = page.getByRole('textbox', { name: 'Search projects' });
  await search.click();
  await search.fill('acme sh');
  await expect(page.locator('.card')).toHaveCount(1);
  await expect(page.locator('.card')).toContainText('Acme Shop');
  await expect(page).toHaveURL(/search=acme(\+|%20)sh/);

  await page.reload();
  await expect(
    page.getByRole('textbox', { name: 'Search projects' })
  ).toHaveValue('acme sh');
  await expect(page.locator('.card')).toHaveCount(1);

  await gotoHydrated(
    page,
    `/${seed.organizationId}?search=zzz-no-such-project`
  );
  await expect(page.locator('.card')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(page.locator('.card').first()).toBeVisible();
  await expect(page).not.toHaveURL(/search=/);
});

test('the chart type menu offers line, area and bar and survives a reload', async ({
  page,
  seed,
}) => {
  await gotoHydrated(page, `/${seed.organizationId}`);
  await page.getByRole('button', { name: 'Linear' }).click();
  const options = page.getByRole('menuitem');
  await expect(options).toHaveCount(3);
  await expect(options).toHaveText(['Linear', 'Bar', 'Area']);
  await page.getByRole('menuitem', { name: 'Bar' }).click();
  await expect(page.getByRole('button', { name: 'Bar' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Bar' })).toBeVisible();
  await expect(
    page.locator('.card').first().locator('svg.overflow-visible').first()
  ).toBeVisible();
});

test('the stacked view shows every stat and survives a reload', async ({
  page,
  seed,
}) => {
  await gotoHydrated(page, `/${seed.organizationId}?range=${RANGE}`);
  await page.getByRole('radio', { name: 'Stacked view' }).click();

  const project = seed.projects[0];
  const data = await trpcQuery<ProjectStats>(
    page,
    'overview.stats',
    statsInput(project.id)
  );
  const card = page.locator('.card', {
    has: page.locator(`a[href="/${seed.organizationId}/${project.id}"]`),
  });
  for (const label of ['Pageviews', 'Bounce rate', 'Visit duration']) {
    await expect(card).toContainText(label);
  }
  await expect(card).toContainText(full.format(data.metrics.unique_visitors));
  await shot(page, 'projects-stacked');

  await page.reload();
  await expect(
    page.getByRole('radio', { name: 'Stacked view' })
  ).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.card').first()).toContainText('Pageviews');
});

test('cards below the fold load when scrolled to', async ({ page, seed }) => {
  const projects = await trpcQuery<ProjectListItem[]>(page, 'project.list', {
    organizationId: seed.organizationId,
  });
  test.skip(
    projects.length <= LAZY_FROM_INDEX,
    'needs more than six projects to have a lazy card'
  );
  await page.setViewportSize({ width: 1280, height: 500 });
  await gotoHydrated(page, `/${seed.organizationId}`);
  const cards = page.locator('.card:has(a[href])');
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeLessThan(projects.length);
  // Lazy cards mount when they enter the viewport, so walk down the page.
  await expect(async () => {
    await page.mouse.wheel(0, 400);
    expect(await cards.count()).toBe(projects.length);
  }).toPass({ timeout: 60_000 });
});

test('the projects page fits a phone and the sidebar opens', async ({
  page,
  seed,
}) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await gotoHydrated(page, `/${seed.organizationId}`);
  await expect(page.locator('.card').first()).toContainText('Visitors');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);

  const settingsLink = page.getByRole('link', {
    name: 'Settings',
    exact: true,
  });
  await expect(settingsLink).not.toBeInViewport();
  await page.locator('button:has(svg.lucide-menu)').click();
  await expect(settingsLink).toBeInViewport();
  await shot(page, 'projects-mobile-sidebar');
  await settingsLink.click();
  await expect(page).toHaveURL(/\/acme\/settings$/);
  await expect(settingsLink).not.toBeInViewport();
});

test('an organization the user is not a member of is refused', async ({
  page,
}) => {
  const response = await page.goto('/e2e-org-not-a-member');
  expect(response?.status()).toBe(404);
  await expect(page.getByText(/not found/i).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Projects' })).toHaveCount(0);
  await shot(page, 'foreign-org');
});

// Open defect: same LinkButton `href` problem; the button points at the page it is on.
test('"Go to home" on the not-found page leaves the page', async ({ page }) => {
  await gotoHydrated(page, '/e2e-org-not-a-member');
  const home = page.getByRole('link', { name: 'Go to home' });
  await expect.soft(home).toHaveAttribute('href', '/');
  await home.click();
  await expect(page).not.toHaveURL(/e2e-org-not-a-member/);
});
