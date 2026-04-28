function toIcsTimestamp(value) {
  return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '');
}

function escapeText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export function downloadCalendar(entries, title) {
  if (!Array.isArray(entries) || !entries.length) {
    return false;
  }

  const now = new Date();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Games28//Country Dashboard//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];

  entries.forEach((entry) => {
    const start = new Date(entry.startAtUtc);
    const end = new Date(entry.endAtUtc || start.getTime() + 60 * 60 * 1000);
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${escapeText(entry.id)}@games28.paulzuiderduin.com`);
    lines.push(`DTSTAMP:${toIcsTimestamp(now)}Z`);
    lines.push(`DTSTART:${toIcsTimestamp(start)}Z`);
    lines.push(`DTEND:${toIcsTimestamp(end)}Z`);
    lines.push(`SUMMARY:${escapeText(`${entry.sport}: ${entry.eventName}`)}`);
    lines.push(`LOCATION:${escapeText(entry.venue || 'Venue TBC')}`);
    lines.push(`DESCRIPTION:${escapeText(`Games28 exported this confirmed session. Source: ${entry.sourceUrl || 'Unavailable'}`)}`);
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${String(title || 'games28').toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'games28'}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

export function buildCalendarFile(entries, title) {
  if (!Array.isArray(entries) || !entries.length) {
    return null;
  }

  const now = new Date();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Games28//Country Dashboard//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];

  entries.forEach((entry) => {
    const start = new Date(entry.startAtUtc);
    const end = new Date(entry.endAtUtc || start.getTime() + 60 * 60 * 1000);
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${escapeText(entry.id)}@games28.paulzuiderduin.com`);
    lines.push(`DTSTAMP:${toIcsTimestamp(now)}Z`);
    lines.push(`DTSTART:${toIcsTimestamp(start)}Z`);
    lines.push(`DTEND:${toIcsTimestamp(end)}Z`);
    lines.push(`SUMMARY:${escapeText(`${entry.sport}: ${entry.eventName}`)}`);
    lines.push(`LOCATION:${escapeText(entry.venue || 'Venue TBC')}`);
    lines.push(`DESCRIPTION:${escapeText(`Games28 exported this session. Source: ${entry.sourceUrl || 'Unavailable'}`)}`);
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const filename = `${String(title || 'games28').toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'games28'}.ics`;
  return { blob, filename };
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

export function downloadCalendarEntries(entries, title) {
  const calendar = buildCalendarFile(entries, title);
  if (!calendar) {
    return false;
  }

  return downloadBlob(calendar.blob, calendar.filename);
}
