/**
 * Integration test for the session list against the isolated `openpanel_test`
 * databases (pinned by test/preload.ts): the fixture's sessions (Alice 2 days
 * ago, Charlie 5 and 10 days ago, test/fixtures.ts) plus one replay chunk for
 * Alice's session.
 */

import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';
import {
  pinFixtureClock,
  releaseFixtureClock,
} from '../../../test/fixture-clock';

const TEST_PROJECT_ID = 'session-list-integration-test';
const TEST_ORG_ID = 'session-list-integration-org';
const LIST_TAKE = 50;
const LOOKBACK_DAYS = 30;

// Bypass Redis caching so a stale profile entry cannot gate an assertion.
const actualRedis = await import('@openpanel/redis');
mock.module('@openpanel/redis', () => ({
  ...actualRedis,
  getCache: async <T>(_key: string, _ttl: number, fn: () => Promise<T>) => fn(),
}));

let FIXTURE: typeof import('../../../../../test/fixtures').FIXTURE;
let ch: typeof import('@openpanel/db/src/clickhouse/client').ch;
let deps: Awaited<
  ReturnType<typeof import('../../../test/service-deps').testServiceDeps>
>;

const deleteReplayChunks = () =>
  ch.command({
    query: `DELETE FROM session_replay_chunks WHERE project_id = '${TEST_PROJECT_ID}'`,
  });

beforeAll(async () => {
  const fixtures = await import('../../../../../test/fixtures');
  FIXTURE = fixtures.FIXTURE;
  ({ ch } = await import('@openpanel/db/src/clickhouse/client'));
  const { testServiceDeps } = await import('../../../test/service-deps');
  deps = await testServiceDeps();

  const { bootstrapTestDatabases } = await import(
    '../../../../../test/bootstrap-databases'
  );
  await bootstrapTestDatabases();
  await fixtures.setupPostgresFixtures(TEST_PROJECT_ID, TEST_ORG_ID);
  const fixtureNow = pinFixtureClock();
  await fixtures.setupFixtures(TEST_PROJECT_ID);

  await deleteReplayChunks();
  await ch.insert({
    table: 'session_replay_chunks',
    values: [
      {
        project_id: TEST_PROJECT_ID,
        session_id: FIXTURE.sessions.alice1,
        chunk_index: 0,
        started_at: fixtures.timeAgo(fixtureNow, 2),
        ended_at: fixtures.timeAgo(fixtureNow, 2),
        events_count: 1,
        is_full_snapshot: true,
        payload: '[]',
      },
    ],
    format: 'JSONEachRow',
  });
}, 30_000);

afterAll(async () => {
  const fixtures = await import('../../../../../test/fixtures');
  await deleteReplayChunks();
  await fixtures.teardownFixtures(TEST_PROJECT_ID);
  await fixtures.teardownPostgresFixtures(TEST_PROJECT_ID, TEST_ORG_ID);
  releaseFixtureClock();
});

describe('getSessionList', () => {
  it('flags the sessions that have a replay', async () => {
    const { getSessionList } = await import('./session.service');
    const { items } = await getSessionList(deps, {
      projectId: TEST_PROJECT_ID,
      take: LIST_TAKE,
      dateIntervalInDays: LOOKBACK_DAYS,
    });
    const hasReplayById = Object.fromEntries(
      items.map((session) => [session.id, session.hasReplay])
    );

    expect(hasReplayById[FIXTURE.sessions.alice1]).toBe(true);
    expect(hasReplayById[FIXTURE.sessions.charlie1]).toBe(false);
  });
});
