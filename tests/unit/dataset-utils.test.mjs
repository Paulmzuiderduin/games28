import test from 'node:test';
import assert from 'node:assert/strict';
import { dayKeyFromDateLabel, localTimeToUtcIso, makeId, parseCsv } from '../../scripts/dataset-utils.mjs';

test('parseCsv handles quoted commas and line endings', () => {
  const rows = parseCsv('A,B\r\n1,"hello, world"\r\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].A, '1');
  assert.equal(rows[0].B, 'hello, world');
});

test('localTimeToUtcIso converts PT and CT schedule times to UTC', () => {
  assert.equal(localTimeToUtcIso('Sunday, July 16', '14:00', 'PT'), '2028-07-16T21:00:00.000Z');
  assert.equal(localTimeToUtcIso('Sunday, July 23', '9:00', 'CT'), '2028-07-23T14:00:00.000Z');
  assert.equal(dayKeyFromDateLabel('Sunday, July 16'), '2028-07-16');
});

test('makeId creates stable schedule ids', () => {
  assert.equal(makeId(['BK301', "Women's Pool Round (2 Games)"]), 'bk301--women-s-pool-round-2-games');
});
