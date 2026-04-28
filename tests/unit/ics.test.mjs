import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCalendarFile } from '../../src/lib/ics.js';

test('buildCalendarFile creates an iCalendar payload for visible sessions', async () => {
  const calendar = buildCalendarFile([
    {
      id: 'bk301',
      sport: '3x3 Basketball',
      eventName: "Women's Pool Round (2 Games)",
      venue: 'Valley Complex 3',
      sourceUrl: 'https://example.com',
      startAtUtc: '2028-07-16T21:00:00.000Z',
      endAtUtc: '2028-07-16T23:00:00.000Z'
    }
  ], 'games28-schedule');

  assert.equal(calendar?.filename, 'games28-schedule.ics');
  const text = await calendar.blob.text();
  assert.match(text, /BEGIN:VCALENDAR/);
  assert.match(text, /SUMMARY:3x3 Basketball: Women's Pool Round \(2 Games\)/);
  assert.match(text, /DTSTART:20280716T210000Z/);
  assert.match(text, /DTEND:20280716T230000Z/);
});
