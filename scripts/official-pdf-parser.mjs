import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  dayKeyFromDateLabel,
  localTimeToUtcIso,
  makeId,
  pickDisciplineLabel
} from './dataset-utils.mjs';

const COLUMN_DEFAULTS = {
  sportStart: 56,
  venueStart: 131,
  zoneStart: 243,
  sessionCodeStart: 294,
  dateStart: 334,
  gamesDayStart: 388,
  sessionTypeStart: 422,
  descriptionStart: 461,
  startTimeStart: 668,
  endTimeStart: 702
};

const SESSION_CODE_RE = /^[A-Z]{2,4}\d{2,3}$/;
const TIME_RE = /^\d{1,2}:\d{2}$/;
const DATE_RE = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+[A-Za-z]+\s+\d{1,2}$/;
const TIMEZONE_HINT_RE = /Time \(([A-Z]{2})\)/;

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function bucketByY(items, tolerance = 1.2) {
  const lines = [];
  const sorted = items
    .filter((item) => normalizeText(item.str))
    .sort((left, right) => {
      if (Math.abs(right.y - left.y) > tolerance) {
        return right.y - left.y;
      }
      return left.x - right.x;
    });

  sorted.forEach((item) => {
    const existing = lines.find((line) => Math.abs(line.y - item.y) <= tolerance);
    if (existing) {
      existing.items.push(item);
      existing.ySamples.push(item.y);
      existing.y = existing.ySamples.reduce((sum, value) => sum + value, 0) / existing.ySamples.length;
      return;
    }

    lines.push({
      y: item.y,
      ySamples: [item.y],
      items: [item]
    });
  });

  return lines
    .map((line) => {
      const itemsByX = [...line.items].sort((left, right) => left.x - right.x);
      const text = itemsByX.map((item) => normalizeText(item.str)).join(' ').replace(/\s+/g, ' ').trim();
      return {
        y: Number(line.y.toFixed(2)),
        items: itemsByX,
        text
      };
    })
    .sort((left, right) => right.y - left.y);
}

function detectColumns(headerLine) {
  if (!headerLine) {
    return COLUMN_DEFAULTS;
  }

  const columns = { ...COLUMN_DEFAULTS };
  headerLine.items.forEach((item) => {
    if (item.str === 'Venue') columns.venueStart = item.x;
    if (item.str === 'Zone') columns.zoneStart = item.x;
    if (item.str === 'Session Code') columns.sessionCodeStart = item.x;
    if (item.str === 'Date') columns.dateStart = item.x;
    if (item.str === 'Games Day') columns.gamesDayStart = item.x;
    if (item.str === 'Session Type') columns.sessionTypeStart = item.x;
    if (item.str === 'Session Description') columns.descriptionStart = item.x;
    if (item.str === 'Start Time') columns.startTimeStart = item.x;
    if (item.str === 'End Time') columns.endTimeStart = item.x;
  });
  return columns;
}

function getColumnName(x, columns) {
  const tolerance = 1.5;
  if (x >= columns.endTimeStart - tolerance) return 'endTime';
  if (x >= columns.startTimeStart - tolerance) return 'startTime';
  if (x >= columns.descriptionStart - tolerance) return 'description';
  if (x >= columns.sessionTypeStart - tolerance) return 'sessionType';
  if (x >= columns.gamesDayStart - tolerance) return 'gamesDay';
  if (x >= columns.dateStart - tolerance) return 'date';
  if (x >= columns.sessionCodeStart - tolerance) return 'sessionCode';
  if (x >= columns.zoneStart - tolerance) return 'zone';
  if (x >= columns.venueStart - tolerance) return 'venue';
  return 'sport';
}

function isBoilerplateLine(line) {
  const text = line.text;
  return (
    !text ||
    text === '3.0' ||
    text.startsWith('Sport Venue Zone Session Code Date Games Day Session Type Session Description Start Time End Time') ||
    text.startsWith('Olympic Competition Schedule by Event Version') ||
    text.startsWith('As of March 16, 2026') ||
    text.startsWith('This competition schedule is subject to change') ||
    text.startsWith('2028 Games.') ||
    text.startsWith('order in which they will occur') ||
    text.startsWith('the Football (Soccer) tournaments') ||
    text.startsWith('are in Pacific Time (PT)') ||
    text.startsWith('specified. All dates listed are')
  );
}

function findSessionCode(line, columns) {
  return line.items.find((item) => getColumnName(item.x, columns) === 'sessionCode' && SESSION_CODE_RE.test(item.str))?.str || null;
}

function hasInlineDescription(line, columns) {
  return line.items.some((item) => getColumnName(item.x, columns) === 'description' && normalizeText(item.str));
}

function extractBaseFields(anchorLine, columns, timezoneFallback = 'PT') {
  const values = {
    sport: [],
    venue: [],
    zone: [],
    sessionCode: [],
    date: [],
    gamesDay: [],
    sessionType: [],
    description: [],
    startTime: [],
    endTime: []
  };

  anchorLine.items.forEach((item) => {
    const text = normalizeText(item.str);
    if (!text) {
      return;
    }
    values[getColumnName(item.x, columns)].push(text);
  });

  const sport = values.sport.join(' ');
  const venue = values.venue.join(' ');
  const zone = values.zone.join(' ');
  const sessionCode = values.sessionCode.find((value) => SESSION_CODE_RE.test(value)) || values.sessionCode.join(' ');
  const dateLabel = values.date.join(' ');
  const gamesDayRaw = values.gamesDay.join(' ').trim();
  const gamesDay = gamesDayRaw === '' ? null : Number(gamesDayRaw);
  const sessionType = values.sessionType.join(' ') || 'Session';
  const startTimeLocal = values.startTime.find((value) => TIME_RE.test(value)) || null;
  const endTimeLocal = values.endTime.find((value) => TIME_RE.test(value)) || null;
  const timezone = /\(([A-Z]{2})\)/.exec(anchorLine.text)?.[1] || timezoneFallback;

  return {
    sport,
    venue,
    zone,
    sessionCode,
    dateLabel,
    dayKey: DATE_RE.test(dateLabel) ? dayKeyFromDateLabel(dateLabel) : null,
    gamesDay,
    sessionType,
    startTimeLocal,
    endTimeLocal,
    timezone
  };
}

function midpoint(a, b) {
  return (a + b) / 2;
}

function normalizeDescriptionLines(lines, columns) {
  const extracted = lines
    .map((line) => {
      const text = line.items
        .filter((item) => {
          const column = getColumnName(item.x, columns);
          return column === 'description';
        })
        .map((item) => normalizeText(item.str))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      return { y: line.y, text };
    })
    .filter((line) => line.text && line.text !== 'N/A');

  const merged = [];
  extracted.forEach((line) => {
    const previous = merged[merged.length - 1];
    const looksLikeContinuation = previous
      && (line.text.startsWith('(') || /^[a-z]/.test(line.text))
      && Math.abs(previous.y - line.y) <= 7;

    if (looksLikeContinuation) {
      previous.text = `${previous.text} ${line.text}`.replace(/\s+/g, ' ').trim();
      previous.y = line.y;
      return;
    }

    merged.push({ ...line });
  });

  return merged.map((line) => line.text);
}

function parseTimeValue(value) {
  if (!TIME_RE.test(String(value || '').trim())) {
    return null;
  }

  const [hour, minute] = String(value).trim().split(':').map((part) => Number(part));
  return (hour * 60) + minute;
}

function extractSupplementalTiming(rowLines, columns, fallbackTimezone) {
  let timezone = fallbackTimezone;
  let startTimeLocal = null;
  let endTimeLocal = null;

  rowLines.forEach((line) => {
    const timezoneMatch = line.text.match(TIMEZONE_HINT_RE);
    if (timezoneMatch) {
      timezone = timezoneMatch[1];
    }

    const startTokens = line.items
      .filter((item) => getColumnName(item.x, columns) === 'startTime')
      .map((item) => normalizeText(item.str))
      .filter((value) => TIME_RE.test(value));
    const endTokens = line.items
      .filter((item) => getColumnName(item.x, columns) === 'endTime')
      .map((item) => normalizeText(item.str))
      .filter((value) => TIME_RE.test(value));

    if (!startTimeLocal && startTokens[0]) {
      [startTimeLocal] = startTokens;
    }
    if (!endTimeLocal && endTokens[0]) {
      [endTimeLocal] = endTokens;
    }
  });

  return {
    timezone,
    startTimeLocal,
    endTimeLocal
  };
}

function extractColumnFragments(rowLines, columns, targetColumn) {
  return rowLines
    .map((line) => line.items
      .filter((item) => getColumnName(item.x, columns) === targetColumn)
      .map((item) => normalizeText(item.str))
      .join(' ')
      .trim())
    .filter(Boolean);
}

function buildUtcRange(dateLabel, startTimeLocal, endTimeLocal, timezone) {
  const startAtUtc = startTimeLocal && dateLabel ? localTimeToUtcIso(dateLabel, startTimeLocal, timezone) : null;
  let endAtUtc = endTimeLocal && dateLabel ? localTimeToUtcIso(dateLabel, endTimeLocal, timezone) : null;

  if (startAtUtc && endAtUtc) {
    const startMinutes = parseTimeValue(startTimeLocal);
    const endMinutes = parseTimeValue(endTimeLocal);

    if (startMinutes !== null && endMinutes !== null && endMinutes <= startMinutes) {
      const overnightEnd = new Date(endAtUtc);
      overnightEnd.setUTCDate(overnightEnd.getUTCDate() + 1);
      endAtUtc = overnightEnd.toISOString();
    }
  }

  return {
    startAtUtc,
    endAtUtc
  };
}

export async function extractPdfPageLines(pdfInput, options = {}) {
  const normalizedInput = Buffer.isBuffer(pdfInput) ? new Uint8Array(pdfInput) : pdfInput;
  const loadingTask = pdfjs.getDocument(normalizedInput);
  const pdf = await loadingTask.promise;
  const pages = options.pages || Array.from({ length: pdf.numPages }, (_, index) => index + 1);
  const results = [];

  for (const pageNumber of pages) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items.map((item) => ({
      str: item.str,
      x: Number(item.transform[4].toFixed(2)),
      y: Number(item.transform[5].toFixed(2)),
      width: Number((item.width || 0).toFixed?.(2) || 0)
    }));
    results.push({
      pageNumber,
      lines: bucketByY(items)
    });
  }

  return results;
}

export function parseScheduleEntriesFromPageLines(pageLines, options = {}) {
  const entries = [];
  let columns = COLUMN_DEFAULTS;

  pageLines.forEach((page) => {
    const headerLine = page.lines.find((line) => line.text.startsWith('Sport Venue Zone Session Code Date Games Day Session Type Session Description Start Time End Time'));
    columns = detectColumns(headerLine || page.lines[0]);

    const usableLines = page.lines.filter((line) => !isBoilerplateLine(line));
    const anchors = usableLines
      .map((line) => ({ line, sessionCode: findSessionCode(line, columns) }))
      .filter((candidate) => candidate.sessionCode)
      .sort((left, right) => right.line.y - left.line.y);

    anchors.forEach((anchor, index) => {
      const previousAnchor = anchors[index - 1];
      const nextAnchor = anchors[index + 1];
      const anchorHasInlineDescription = hasInlineDescription(anchor.line, columns);
      const previousHasInlineDescription = previousAnchor ? hasInlineDescription(previousAnchor.line, columns) : false;
      const nextHasInlineDescription = nextAnchor ? hasInlineDescription(nextAnchor.line, columns) : false;

      const upperBound = previousAnchor
        ? (!anchorHasInlineDescription && previousHasInlineDescription
          ? previousAnchor.line.y
          : midpoint(previousAnchor.line.y, anchor.line.y))
        : Number.POSITIVE_INFINITY;
      const lowerBound = nextAnchor
        ? (!anchorHasInlineDescription && nextHasInlineDescription
          ? nextAnchor.line.y
          : midpoint(anchor.line.y, nextAnchor.line.y))
        : Number.NEGATIVE_INFINITY;
      const rowLines = usableLines.filter((line) => line.y <= upperBound && line.y > lowerBound);
      const base = extractBaseFields(anchor.line, columns, options.timezoneFallback || 'PT');
      const sportFragments = extractColumnFragments(rowLines, columns, 'sport');
      if (!base.sport && sportFragments.length) {
        base.sport = sportFragments.join(' ').replace(/\s+/g, ' ').trim();
      }
      const supplementalTiming = extractSupplementalTiming(rowLines, columns, base.timezone);
      const timezone = supplementalTiming.timezone || base.timezone;
      const startTimeLocal = base.startTimeLocal || supplementalTiming.startTimeLocal;
      const endTimeLocal = base.endTimeLocal || supplementalTiming.endTimeLocal;
      const descriptions = normalizeDescriptionLines(anchorHasInlineDescription ? [anchor.line] : rowLines, columns);
      const eventNames = descriptions.length ? descriptions : ['Session details pending'];
      const { startAtUtc, endAtUtc } = buildUtcRange(base.dateLabel, startTimeLocal, endTimeLocal, timezone);

      eventNames.forEach((eventName, descriptionIndex) => {
        const id = makeId([base.sessionCode, eventName, descriptionIndex]);
        entries.push({
          id,
          athleteIds: [],
          competitionDay: base.gamesDay,
          dayKey: base.dayKey,
          description: eventName,
          discipline: pickDisciplineLabel(base.sport, eventName),
          endTimeLocal,
          endAtUtc,
          eventName,
          gamesDay: base.gamesDay,
          nocs: [],
          pageNumber: page.pageNumber,
          phase: base.sessionType,
          sessionCode: base.sessionCode,
          sourceVersion: options.sourceVersion || null,
          sourcePdfHash: options.sourcePdfHash || null,
          sourceUrl: options.sourcePdfUrl || null,
          sport: base.sport,
          startTimeLocal,
          startAtUtc,
          status: 'scheduled',
          timezone,
          venue: base.venue,
          zone: base.zone,
          dateLabel: base.dateLabel
        });
      });
    });
  });

  return entries.sort((left, right) => {
    const leftKey = `${left.startAtUtc || ''}-${left.sessionCode}-${left.eventName}`;
    const rightKey = `${right.startAtUtc || ''}-${right.sessionCode}-${right.eventName}`;
    return leftKey.localeCompare(rightKey);
  });
}

export async function parseOfficialSchedulePdf(pdfInput, options = {}) {
  const pageLines = await extractPdfPageLines(pdfInput, options);
  return parseScheduleEntriesFromPageLines(pageLines, options);
}
