import test from 'node:test';
import assert from 'node:assert/strict';
import { isMedalEvent } from '../../src/lib/schedule-events.js';

test('medal detection ignores misleading session-level phases', () => {
  assert.equal(isMedalEvent({ eventName: 'Mixed Doubles Semifinal', phase: 'Final' }), false);
  assert.equal(isMedalEvent({ eventName: "Women's Quarterfinal", phase: 'Semifinal' }), false);
  assert.equal(isMedalEvent({ eventName: "Men's Group Play", phase: 'Final' }), false);
});

test('medal detection recognizes event-level medal contests and finals', () => {
  assert.equal(isMedalEvent({ eventName: "Women's Gold Medal Match", phase: 'Final' }), true);
  assert.equal(isMedalEvent({ eventName: "Men's 60kg Bronze Contests", phase: 'Final' }), true);
  assert.equal(isMedalEvent({ eventName: "Women's 100m Final", phase: 'Final' }), true);
  assert.equal(isMedalEvent({ eventName: "Men's Individual Finals", phase: 'Final' }), true);
});

test('final must be a complete word', () => {
  assert.equal(isMedalEvent({ eventName: 'Semifinal' }), false);
  assert.equal(isMedalEvent({ eventName: 'Quarterfinal' }), false);
  assert.equal(isMedalEvent({ eventName: "Women's Single Sculls Final B" }), false);
  assert.equal(isMedalEvent({ eventName: "Men's Pair Final C" }), false);
});
