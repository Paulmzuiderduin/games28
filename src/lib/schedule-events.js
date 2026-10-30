const MEDAL_EVENT_PATTERN = /\b(?:gold medal|bronze|medal (?:match|game|contest|bout|race|event)|finals?)\b/i;
const NON_MEDAL_CLASSIFICATION_FINAL_PATTERN = /\bfinals?\s+[b-z]\b/i;

export function isMedalEvent(entry) {
  // LA28's `phase` describes the whole session and may not match this event.
  const eventName = String(entry?.eventName || '').replace(/\b(semi|quarter)[\s\u2010-\u2015-]+finals?\b/gi, '$1final');
  if (/\b(?:qualification|qualifying|classification|placement)\b/i.test(eventName)) return false;
  if (/\bfinals?\s+for\s+places?\b/i.test(eventName)) return false;
  return MEDAL_EVENT_PATTERN.test(eventName) && !NON_MEDAL_CLASSIFICATION_FINAL_PATTERN.test(eventName);
}

export function getSessionKey(entry) {
  return entry?.sessionCode || entry?.id || null;
}

export function countUniqueSessions(entries = []) {
  return new Set(entries.map(getSessionKey).filter(Boolean)).size;
}

export function groupEntriesBySession(entries = []) {
  const groups = new Map();
  entries.forEach((entry) => {
    const key = getSessionKey(entry) || entry?.id;
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });
  return [...groups.values()];
}
