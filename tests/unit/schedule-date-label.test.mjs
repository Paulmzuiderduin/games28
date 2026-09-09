import test from 'node:test';
import assert from 'node:assert/strict';
import { formatScheduleDate, formatDateLabel } from '../../src/lib/format.js';

test('known source date without time is displayed without inventing a local date', () => {
  const entry = { dayKey: '2028-07-14', startAtUtc: null };
  const la = formatScheduleDate(entry, { timeZone: 'America/Los_Angeles' });
  const tokyo = formatScheduleDate(entry, { timeZone: 'Asia/Tokyo' });
  assert.equal(la, tokyo);
  assert.match(la, /14/);
  assert.match(la, /source date/);
});
test('timed sessions still use the visitor timezone', () => {
  const entry = { startAtUtc: '2028-07-15T02:00:00Z', dayKey: '2028-07-14' };
  const options = { timeZone: 'Asia/Tokyo' };
  assert.equal(formatScheduleDate(entry, options), formatDateLabel(entry.startAtUtc, options));
});
test('missing or malformed dates do not roll over or crash', () => {
  for (const dayKey of [null, '', '2028-02-31', 'unknown']) {
    assert.equal(formatScheduleDate({ dayKey, startAtUtc: 'bad-date' }), 'Date not announced');
  }
});
