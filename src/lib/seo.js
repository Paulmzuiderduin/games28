export const SITE_ORIGIN = 'https://games28.paulzuiderduin.com';
export const SITE_NAME = 'Games28';
export const SOCIAL_IMAGE_URL = `${SITE_ORIGIN}/social-card.svg`;

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

export function getSportSlug(sport) {
  return slugify(sport);
}

export function getSportPath(sport) {
  return `/sports/${getSportSlug(sport)}`;
}

export function findSportBySlug(scheduleEntries, sportSlug) {
  return [...new Set((scheduleEntries || []).map((entry) => entry.sport).filter(Boolean))]
    .find((sport) => getSportSlug(sport) === sportSlug) || null;
}

export function getSessionPath(sessionId) {
  return `/sessions/${encodeURIComponent(sessionId)}`;
}

export function selectSeoSessionEntries(scheduleEntries, limit = 240) {
  const priorityPattern = /\b(final|gold medal|bronze medal|medal|marathon|opening|closing)\b/i;
  const withTimes = (scheduleEntries || []).filter((entry) => entry.startAtUtc);
  const priority = withTimes.filter((entry) => priorityPattern.test(`${entry.eventName} ${entry.phase} ${entry.description}`));
  const remaining = withTimes.filter((entry) => !priority.includes(entry));
  const byStart = (left, right) => String(left.startAtUtc).localeCompare(String(right.startAtUtc));

  return [...priority.sort(byStart), ...remaining.sort(byStart)]
    .slice(0, limit);
}

export function routeUrl(path) {
  return `${SITE_ORIGIN}${path === '/' ? '/' : path}`;
}
