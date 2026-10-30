function timestamp(value) {
  return new Date(value)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function escapeText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

function validDate(value) {
  return typeof value === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
}

export function getExportableEntries(entries = []) {
  const seen = new Set();
  return entries.filter((entry) => {
    if (!entry.id || seen.has(entry.id) || !validDate(entry.startAtUtc)) return false;
    if (entry.endAtUtc && (!validDate(entry.endAtUtc) || Date.parse(entry.endAtUtc) <= Date.parse(entry.startAtUtc)))
      return false;
    seen.add(entry.id);
    return true;
  });
}

// RFC 5545 folds at 75 octets, not 75 JS characters; never split a UTF-8 code point.
function foldLine(line) {
  const encoder = new TextEncoder();
  let result = '',
    length = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (length + size > 75) {
      result += '\r\n ';
      length = 1;
    }
    result += char;
    length += size;
  }
  return result;
}

export function buildCalendarFile(entries, title) {
  const input = Array.isArray(entries) ? entries : [];
  const valid = getExportableEntries(input);
  if (!valid.length) return null;
  const groups = [];
  const groupByKey = new Map();
  valid.forEach((entry) => {
    // Multiple event rows can describe the same Olympic session. Keep one
    // calendar event per session/time block instead of overlapping duplicates.
    const key = entry.sessionCode
      ? `${entry.sessionCode}|${entry.startAtUtc}|${entry.endAtUtc || ''}`
      : `entry|${entry.id}`;
    let group = groupByKey.get(key);
    if (!group) {
      group = [];
      groupByKey.set(key, group);
      groups.push(group);
    }
    group.push(entry);
  });

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Games28//Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];
  const now = timestamp(new Date().toISOString());
  groups.forEach((group) => {
    const [primary] = group;
    const unique = (values) => [...new Set(values.filter(Boolean))];
    const eventNames = unique(group.map((entry) => entry.eventName));
    const venues = unique(group.map((entry) => entry.venue));
    const sourceUrls = unique(group.map((entry) => entry.sourceUrl));
    const isSessionGroup = group.length > 1 && Boolean(primary.sessionCode);
    const summary = isSessionGroup
      ? `${primary.sport}: Session ${primary.sessionCode}`
      : `${primary.sport}: ${primary.eventName}`;
    const description = isSessionGroup
      ? `Games28 session ${primary.sessionCode}. Events: ${eventNames.join('; ')}.${sourceUrls.length ? ` Source: ${sourceUrls.join(' ')}` : ''}`
      : `Games28 schedule. Source: ${sourceUrls[0] || 'Unavailable'}`;
    const uid = isSessionGroup ? `${primary.sessionCode}--${primary.startAtUtc}` : primary.id;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${escapeText(uid)}@games28.paulzuiderduin.com`,
      `DTSTAMP:${now}`,
      `DTSTART:${timestamp(primary.startAtUtc)}`
    );
    if (primary.endAtUtc) lines.push(`DTEND:${timestamp(primary.endAtUtc)}`);
    lines.push(
      `SUMMARY:${escapeText(summary)}`,
      `LOCATION:${escapeText(venues.join(', ') || 'Venue TBC')}`,
      `DESCRIPTION:${escapeText(description)}`,
      'END:VEVENT'
    );
  });
  lines.push('END:VCALENDAR');
  return {
    blob: new Blob([lines.map(foldLine).join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' }),
    filename: `${
      String(title || 'games28')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-') || 'games28'
    }.ics`,
    exportedCount: groups.length,
    skippedCount: input.length - valid.length,
    collapsedCount: valid.length - groups.length
  };
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export function downloadCalendarEntries(entries, title) {
  const calendar = buildCalendarFile(entries, title);
  if (!calendar || !downloadBlob(calendar.blob, calendar.filename)) return null;
  return calendar;
}
