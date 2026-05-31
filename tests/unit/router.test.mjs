import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute } from '../../src/lib/router.js';

test('parseRoute accepts trailing slashes on wired routes', () => {
  assert.deepEqual(parseRoute('/countries/AFG/'), {
    name: 'country',
    noc: 'AFG'
  });

  assert.deepEqual(parseRoute('/schedule/'), {
    name: 'schedule'
  });

  assert.deepEqual(parseRoute('/sessions/swim-01/'), {
    name: 'session',
    sessionId: 'swim-01'
  });
});
