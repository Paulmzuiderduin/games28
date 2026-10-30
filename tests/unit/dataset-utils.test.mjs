import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  dayKeyFromDateLabel,
  localTimeToUtcIso,
  makeId,
  parseCsv,
  readJsonIfExists,
  readJsonRequired
} from '../../scripts/dataset-utils.mjs';

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

test('readJsonRequired distinguishes missing and malformed required datasets', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'games28-required-json-'));
  await assert.rejects(readJsonRequired(join(dir, 'missing.json')), /missing or unreadable/);
  const invalid = join(dir, 'invalid.json');
  await writeFile(invalid, '{broken');
  await assert.rejects(readJsonRequired(invalid), /not valid JSON/);
  const valid = join(dir, 'valid.json');
  await writeFile(valid, '{"ok":true}');
  assert.deepEqual(await readJsonRequired(valid), { ok: true });
});

test('readJsonIfExists allows a missing first-run file but rejects corruption', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'games28-optional-json-'));
  assert.deepEqual(await readJsonIfExists(join(dir, 'missing.json'), { firstRun: true }), { firstRun: true });
  const invalid = join(dir, 'invalid.json');
  await writeFile(invalid, '{broken');
  await assert.rejects(readJsonIfExists(invalid, null), /not valid JSON/);
});
