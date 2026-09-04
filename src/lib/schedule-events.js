const MEDAL_EVENT_PATTERN = /\b(?:gold medal|bronze|medal (?:match|game|contest|bout|race|event)|finals?)\b/i;
const NON_MEDAL_CLASSIFICATION_FINAL_PATTERN = /\bfinals?\s+[b-z]\b/i;

export function isMedalEvent(entry) {
  // LA28's `phase` describes the whole session and may not match this event.
  const eventName = String(entry?.eventName || '');
  return MEDAL_EVENT_PATTERN.test(eventName) && !NON_MEDAL_CLASSIFICATION_FINAL_PATTERN.test(eventName);
}
