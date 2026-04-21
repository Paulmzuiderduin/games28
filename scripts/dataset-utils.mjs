import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

export async function readJson(path, fallback = null) {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

export async function readText(path, fallback = '') {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    return fallback;
  }
}

export async function readBuffer(path, fallback = null) {
  try {
    return await readFile(path);
  } catch (error) {
    return fallback;
  }
}

export async function writeTextIfChanged(path, text) {
  const current = await readText(path, null);
  if (current === text) {
    return false;
  }
  await writeFile(path, text, 'utf8');
  return true;
}

export async function writeJsonIfChanged(path, value) {
  const next = stableStringify(value) + '\n';
  return writeTextIfChanged(path, next);
}

export async function writeBufferIfChanged(path, buffer) {
  const current = await readBuffer(path, null);
  if (current && Buffer.compare(current, buffer) === 0) {
    return false;
  }
  await writeFile(path, buffer);
  return true;
}

export function stableStringify(value) {
  return JSON.stringify(sortValue(value), null, 2);
}

function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((accumulator, key) => {
        accumulator[key] = sortValue(value[key]);
        return accumulator;
      }, {});
  }

  return value;
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ',') {
      row.push(cell);
      cell = '';
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }
      row.push(cell);
      cell = '';
      if (row.some((value) => value !== '')) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    cell += char;
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const [headerRow = [], ...dataRows] = rows;
  return dataRows.map((cells) => {
    return headerRow.reduce((record, header, index) => {
      record[header] = cells[index] ?? '';
      return record;
    }, {});
  });
}

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function makeId(parts) {
  return parts.map((part) => slugify(part)).filter(Boolean).join('--');
}

export function sha256Hex(input) {
  return createHash('sha256').update(input).digest('hex');
}

export function parseMonthDayLabel(value) {
  const match = String(value || '').match(/([A-Za-z]+),\s+([A-Za-z]+)\s+(\d{1,2})/);
  if (!match) {
    throw new Error(`Unsupported date label: ${value}`);
  }

  const [, weekday, monthName, day] = match;
  const monthLookup = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12
  };

  const month = monthLookup[monthName.toLowerCase()];
  if (!month) {
    throw new Error(`Unsupported month label: ${monthName}`);
  }

  return {
    weekday,
    month,
    day: Number(day)
  };
}

export function localTimeToUtcIso(dateLabel, timeLabel, timezone = 'PT') {
  const { month, day } = parseMonthDayLabel(dateLabel);
  const rawTime = String(timeLabel || '00:00').trim();
  const timeMatch = rawTime.match(/(\d{1,2}:\d{2})/);
  const [hour, minute] = (timeMatch ? timeMatch[1] : '00:00').split(':').map((value) => Number(value));
  const zoneMatch = rawTime.match(/\(([A-Z]{2})\)/);
  const zone = zoneMatch?.[1] || timezone;
  const offsets = {
    PT: 7,
    MT: 6,
    CT: 5,
    ET: 4
  };
  const utcOffset = offsets[zone] || 7;
  const utcDate = new Date(Date.UTC(2028, month - 1, day, hour + utcOffset, minute || 0, 0));
  return utcDate.toISOString();
}

export function dayKeyFromDateLabel(dateLabel) {
  const { month, day } = parseMonthDayLabel(dateLabel);
  return `2028-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function pickDisciplineLabel(sport, eventName) {
  const cleanedEvent = String(eventName || '')
    .replace(/\(([^)]+)\)/g, '')
    .replace(/men's|women's|mixed|open/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleanedEvent || sport;
}

export function buildChangeId(parts) {
  return makeId(parts);
}

export function asComparableCountMap(entries, keyBuilder) {
  return entries.reduce((accumulator, entry) => {
    const key = keyBuilder(entry);
    accumulator.set(key, (accumulator.get(key) || 0) + 1);
    return accumulator;
  }, new Map());
}
