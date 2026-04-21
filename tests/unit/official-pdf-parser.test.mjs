import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseOfficialSchedulePdf } from '../../scripts/official-pdf-parser.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const pdfPath = resolve(__dirname, '../../src/data/official-schedule-by-event.snapshot.pdf');
const pdfBytes = readFileSync(pdfPath);

test('official PDF parser keeps inline descriptions isolated from neighboring rows', async () => {
  const entries = await parseOfficialSchedulePdf(pdfBytes, {
    pages: [1, 2],
    sourcePdfUrl: 'https://example.com/la28.pdf',
    sourcePdfHash: 'hash',
    sourceVersion: 'V3.0'
  });

  const gar01Entries = entries.filter((entry) => entry.sessionCode === 'GAR01');
  assert.equal(gar01Entries.length, 1);
  assert.equal(gar01Entries[0].eventName, "Men's Qualification 1");

  const arc17Entries = entries.filter((entry) => entry.sessionCode === 'ARC17');
  assert.equal(arc17Entries.some((entry) => entry.eventName === "Recurve Women's Individual Gold Medal Match"), true);
  assert.equal(arc17Entries.some((entry) => entry.eventName === "Recurve Women's Individual Quarterfinal"), true);
});

test('official PDF parser derives local-time overrides and overnight end times', async () => {
  const entries = await parseOfficialSchedulePdf(pdfBytes, {
    pages: [7, 11, 31],
    sourcePdfUrl: 'https://example.com/la28.pdf',
    sourcePdfHash: 'hash',
    sourceVersion: 'V3.0'
  });

  const softball = entries.find((entry) => entry.sessionCode === 'BSB13');
  assert.equal(softball?.timezone, 'CT');
  assert.equal(softball?.startTimeLocal, '9:00');
  assert.equal(softball?.endTimeLocal, '11:30');

  const tennis = entries.find((entry) => entry.sessionCode === 'TEN10' && entry.eventName.includes('Gold Medal Match'));
  assert.equal(tennis?.endAtUtc, '2028-07-21T07:00:00.000Z');
});
