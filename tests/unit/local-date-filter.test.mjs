import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScheduleOptions, filterScheduleEntries } from '../../src/lib/view-models.js';

const entries = [
  { id: 'evening', sport: 'Swimming', dayKey: '2028-07-19', startAtUtc: '2028-07-20T02:00:00Z' },
  { id: 'unknown', sport: 'Swimming', dayKey: '2028-07-19', startAtUtc: null }
];
for (const [timeZone, day] of [['Europe/Amsterdam', '2028-07-20'], ['America/Los_Angeles', '2028-07-19'], ['Asia/Tokyo', '2028-07-20']]) {
  test(`date options and filtering agree in ${timeZone}`, () => {
    assert.deepEqual(buildScheduleOptions(entries, { timeZone }).dayOptions, [day, 'time-tbd']);
    assert.deepEqual(filterScheduleEntries(entries, { sport: 'all', dayKey: day, searchText: '' }, { timeZone }).map(e => e.id), ['evening']);
  });
}
test('unknown start times are not assigned an invented local date', () => {
  assert.deepEqual(filterScheduleEntries(entries, { sport: 'all', dayKey: 'time-tbd' }).map(e => e.id), ['unknown']);
});
