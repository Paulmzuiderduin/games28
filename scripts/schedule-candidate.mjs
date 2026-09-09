import { makeId, sha256Hex } from './dataset-utils.mjs';
import { parseOfficialSchedulePdf } from './official-pdf-parser.mjs';

const identity = (row) => JSON.stringify([row.sessionCode, row.eventName]);

export function preserveScheduleIds(candidate, previous = []) {
  const existing = new Map();
  for (const row of previous) {
    if (!row.id) continue;
    const ids = existing.get(identity(row)) || new Set();
    for (const id of [row.id, ...(row.aliasIds || [])]) ids.add(id);
    existing.set(identity(row), ids);
  }
  return candidate.map((row) => {
    const [id, ...aliasIds] = existing.get(identity(row)) || [];
    return {
      ...row,
      id: id || `${makeId([row.sessionCode, row.eventName])}--${sha256Hex(identity(row)).slice(0, 12)}`,
      ...(aliasIds.length ? { aliasIds } : {})
    };
  });
}

export async function buildScheduleCandidate(pdf, options, previous = [], parse = parseOfficialSchedulePdf) {
  try {
    const entries = preserveScheduleIds(await parse(pdf, options), previous);
    if (!entries.length) throw new Error('Official PDF produced no schedule entries');
    if (new Set(entries.map(identity)).size !== entries.length) throw new Error('Duplicate session/event identities in official PDF');
    return { entries, parserError: null };
  } catch (error) {
    return { entries: [], parserError: String(error?.message || error).slice(0, 500) };
  }
}
