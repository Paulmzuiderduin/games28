function timestamp(value) {
  return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeText(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
}

function validDate(value) {
  return typeof value === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
}

export function getExportableEntries(entries = []) {
  const seen = new Set();
  return entries.filter((entry) => {
    if (!entry.id || seen.has(entry.id) || !validDate(entry.startAtUtc)) return false;
    if (entry.endAtUtc && (!validDate(entry.endAtUtc) || Date.parse(entry.endAtUtc) <= Date.parse(entry.startAtUtc))) return false;
    seen.add(entry.id);
    return true;
  });
}

// RFC 5545 folds at 75 octets, not 75 JS characters; never split a UTF-8 code point.
function foldLine(line) {
  const encoder = new TextEncoder();
  let result = '', length = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (length + size > 75) { result += '\r\n '; length = 1; }
    result += char;
    length += size;
  }
  return result;
}

export function buildCalendarFile(entries, title) {
  const valid = getExportableEntries(Array.isArray(entries) ? entries : []);
  if (!valid.length) return null;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Games28//Schedule//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  const now = timestamp(new Date().toISOString());
  valid.forEach((entry) => {
    lines.push('BEGIN:VEVENT', `UID:${escapeText(entry.id)}@games28.paulzuiderduin.com`, `DTSTAMP:${now}`, `DTSTART:${timestamp(entry.startAtUtc)}`);
    if (entry.endAtUtc) lines.push(`DTEND:${timestamp(entry.endAtUtc)}`);
    lines.push(`SUMMARY:${escapeText(`${entry.sport}: ${entry.eventName}`)}`, `LOCATION:${escapeText(entry.venue || 'Venue TBC')}`, `DESCRIPTION:${escapeText(`Games28 schedule. Source: ${entry.sourceUrl || 'Unavailable'}`)}`, 'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return {
    blob: new Blob([lines.map(foldLine).join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' }),
    filename: `${String(title || 'games28').toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'games28'}.ics`,
    exportedCount: valid.length,
    skippedCount: entries.length - valid.length
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
  return calendar ? downloadBlob(calendar.blob, calendar.filename) : false;
}

export const downloadCalendar = downloadCalendarEntries;
