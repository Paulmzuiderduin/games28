import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseOfficialSchedulePdf, parseScheduleEntriesFromPageLines } from '../../scripts/official-pdf-parser.mjs';

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

test('border candidate recovers complete compound archery session without stealing adjacent events', async () => {
  const entries = await parseOfficialSchedulePdf(pdfBytes, { pages: [1], tableBorders: true });
  assert.deepEqual(entries.filter((entry) => entry.sessionCode === 'ARC03').map((entry) => entry.eventName).sort(), [
    'Compound Mixed Team 1/8 Elimination Round',
    'Compound Mixed Team Bronze Medal Match',
    'Compound Mixed Team Gold Medal Match',
    'Compound Mixed Team Quarterfinal',
    'Compound Mixed Team Semifinal'
  ]);
  assert.equal(entries.filter((entry) => entry.sessionCode === 'ARC04').length, 2);
});

test('border extraction places badminton rounds in their actual PDF sessions', async () => {
  const entries = await parseOfficialSchedulePdf(pdfBytes, { pages: [6], tableBorders: true });
  const events = (session) => entries.filter((entry) => entry.sessionCode === session).map((entry) => entry.eventName);
  assert.deepEqual(events('BDM15').sort(), ["Men's Singles Group Play Stage", "Women's Singles Group Play Stage"]);
  assert.ok(events('BDM16').includes('Mixed Doubles Semifinal'));
  assert.ok(events('BDM19').includes('Mixed Doubles Gold Medal Match'));
  assert.ok(!events('BDM18').includes('Mixed Doubles Gold Medal Match'));
});

test('wrapped venue is complete and canoe timing cannot leak from previous sport', async () => {
  const entries = await parseOfficialSchedulePdf(pdfBytes, { pages: [12, 23] });
  assert.equal(entries.find((entry) => entry.sessionCode === 'CRD02').venue,
    'Venice Beach Boardwalk (Start) / Griffith Observatory (Finish)');
  const canoe = entries.filter((entry) => entry.sessionCode === 'CSL01');
  assert.equal(canoe.length, 2);
  assert.ok(canoe.every((entry) => entry.startTimeLocal === '9:00' && entry.endTimeLocal === '12:10'));
});

test('changed borders and unanchored continuation rows fail instead of guessing', () => {
  const anchor = { y: 90, text: 'ARC01', items: [{ x: 294, str: 'ARC01' }] };
  assert.throws(() => parseScheduleEntriesFromPageLines([{ pageNumber: 1, lines: [anchor] }]), /Uncertain PDF row/);
  const continuation = { y: 70, text: 'Final', items: [{ x: 461, str: 'Final' }] };
  assert.throws(() => parseScheduleEntriesFromPageLines([{
    pageNumber: 1, rowSeparators: [100, 80, 60], lines: [anchor, continuation]
  }]), /Unassigned description/);
  assert.throws(() => parseScheduleEntriesFromPageLines([{
    pageNumber: 1, rowSeparators: [100, 80], lines: [anchor, { ...anchor, y: 85 }]
  }]), /Uncertain PDF row/);
});
