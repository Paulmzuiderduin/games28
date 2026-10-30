import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCalendarFile } from '../../src/lib/ics.js';

test('buildCalendarFile creates an iCalendar payload for visible sessions', async () => {
  const calendar = buildCalendarFile(
    [
      {
        id: 'bk301',
        sport: '3x3 Basketball',
        eventName: "Women's Pool Round (2 Games)",
        venue: 'Valley Complex 3',
        sourceUrl: 'https://example.com',
        startAtUtc: '2028-07-16T21:00:00.000Z',
        endAtUtc: '2028-07-16T23:00:00.000Z'
      }
    ],
    'games28-schedule'
  );

  assert.equal(calendar?.filename, 'games28-schedule.ics');
  const text = await calendar.blob.text();
  assert.match(text, /BEGIN:VCALENDAR/);
  assert.match(text, /SUMMARY:3x3 Basketball: Women's Pool Round \(2 Games\)/);
  assert.match(text, /DTSTART:20280716T210000Z/);
  assert.match(text, /DTEND:20280716T230000Z/);
});

test('calendar skips TBD and invalid dates instead of exporting January 1970', async () => {
  const good = { id: 'valid', startAtUtc: '2028-07-16T21:00:00Z', sport: 'Swimming', eventName: 'Final' };
  assert.equal(buildCalendarFile([{ ...good, startAtUtc: null }], 'test'), null);
  const calendar = buildCalendarFile(
    [good, { ...good, id: 'bad', startAtUtc: null }, { ...good, id: 'invalid', endAtUtc: 'bad' }],
    'test'
  );
  assert.equal(calendar.exportedCount, 1);
  assert.equal(calendar.skippedCount, 2);
  const text = await calendar.blob.text();
  assert.doesNotMatch(text, /1970|DTEND/);
});
test('calendar folds UTF-8 lines and escapes carriage returns', async () => {
  const calendar = buildCalendarFile(
    [
      {
        id: 'unicode',
        sport: 'Swimming',
        eventName: 'é'.repeat(100) + '\rINJECTED',
        startAtUtc: '2028-07-16T21:00:00Z'
      }
    ],
    'test'
  );
  const text = await calendar.blob.text();
  for (const line of text.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75);
  assert.match(text.replace(/\r\n /g, ''), /\\nINJECTED/);
});

test('calendar groups event rows from one session into one VEVENT', async () => {
  const entries = [
    {
      id: 'ctr05-a',
      sessionCode: 'CTR05',
      sport: 'Cycling Track',
      eventName: "Men's Sprint Final for Places 5-8",
      venue: 'Carson Velodrome',
      startAtUtc: '2028-07-27T18:00:00Z',
      endAtUtc: '2028-07-27T20:00:00Z'
    },
    {
      id: 'ctr05-b',
      sessionCode: 'CTR05',
      sport: 'Cycling Track',
      eventName: "Women's Keirin Final",
      venue: 'Carson Velodrome',
      startAtUtc: '2028-07-27T18:00:00Z',
      endAtUtc: '2028-07-27T20:00:00Z'
    }
  ];
  const calendar = buildCalendarFile(entries, 'ctr05');
  assert.equal(calendar.exportedCount, 1);
  assert.equal(calendar.collapsedCount, 1);
  const text = await calendar.blob.text();
  assert.equal((text.match(/BEGIN:VEVENT/g) || []).length, 1);
  const unfolded = text.replace(/\r\n /g, '');
  assert.match(unfolded, /SUMMARY:Cycling Track: Session CTR05/);
  assert.match(unfolded, /Events: Men's Sprint Final for Places 5-8\\; Women's Keirin Final/);
});
