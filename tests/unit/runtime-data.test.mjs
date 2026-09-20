import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRuntimeDataset } from '../../src/lib/runtime-data.js';

test('runtime loading rejects failed requests instead of silently showing an empty dataset', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response(null, { status: 503 });

  await assert.rejects(loadRuntimeDataset(), /Runtime dataset request failed with 503/);
});

test('runtime loading removes legacy allocated team cards from the public dataset', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.cache, 'no-store');
    return new Response(JSON.stringify({
      athleteCards: [
        { id: 'legacy-team', subjectType: 'team', state: 'allocated' },
        { id: 'team-quota', subjectType: 'team_quota', state: 'allocated' }
      ]
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const runtime = await loadRuntimeDataset();
  assert.deepEqual(runtime.athleteCards.map((card) => card.id), ['team-quota']);
});
