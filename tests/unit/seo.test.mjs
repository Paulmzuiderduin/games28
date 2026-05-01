import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findSportBySlug,
  getSessionPath,
  getSportPath,
  selectSeoSessionEntries,
  slugify
} from '../../src/lib/seo.js';

test('slugify creates stable URL slugs for sport names', () => {
  assert.equal(slugify('Football (Soccer)'), 'football-soccer');
  assert.equal(getSportPath('3x3 Basketball'), '/sports/3x3-basketball');
});

test('findSportBySlug resolves sports from schedule entries', () => {
  const entries = [{ sport: 'Football (Soccer)' }, { sport: 'Swimming' }];
  assert.equal(findSportBySlug(entries, 'football-soccer'), 'Football (Soccer)');
  assert.equal(findSportBySlug(entries, 'missing'), null);
});

test('selectSeoSessionEntries prioritizes medal and final sessions with times', () => {
  const selected = selectSeoSessionEntries([
    { id: 'early', eventName: 'Pool Round', phase: 'Preliminary', startAtUtc: '2028-07-15T10:00:00Z' },
    { id: 'final', eventName: 'Gold Medal Match', phase: 'Final', startAtUtc: '2028-07-20T10:00:00Z' },
    { id: 'tbd', eventName: 'Final', phase: 'Final', startAtUtc: null }
  ], 1);

  assert.equal(selected[0].id, 'final');
});

test('getSessionPath encodes ids for route generation', () => {
  assert.equal(getSessionPath('swm01--women-s-final'), '/sessions/swm01--women-s-final');
});
