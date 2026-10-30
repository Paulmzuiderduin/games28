import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRuntimeDataset } from '../../src/lib/runtime-data.js';

test('runtime loading rejects failed requests instead of silently showing an empty dataset', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => new Response(null, { status: 503 });

  await assert.rejects(loadRuntimeDataset(), /Runtime dataset request failed with 503/);
});

test('runtime loading removes legacy allocated team cards from the public dataset', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.cache, 'no-store');
    return new Response(
      JSON.stringify({
        athleteCards: [
          { id: 'legacy-team', subjectType: 'team', state: 'allocated' },
          { id: 'team-quota', subjectType: 'team_quota', state: 'allocated' }
        ]
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  };

  const runtime = await loadRuntimeDataset();
  assert.deepEqual(
    runtime.athleteCards.map((card) => card.id),
    ['team-quota']
  );
});

test('runtime loading uses the small meta version to cache the large dataset', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('runtime.meta.json')) {
      return new Response(
        JSON.stringify({ checkedAt: '2026-10-07T11:47:38.757Z', runtimeVersion: 'runtime-hash-123' }),
        { status: 200 }
      );
    }
    return new Response(JSON.stringify({ athleteCards: [] }), { status: 200 });
  };

  await loadRuntimeDataset();
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.cache, 'no-store');
  assert.match(calls[1].url, /runtime\.json\?v=runtime-hash-123$/);
  assert.equal(calls[1].options.cache, 'force-cache');
});
