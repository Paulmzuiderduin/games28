function getViewerTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function formatCount(value) {
  return new Intl.NumberFormat(undefined).format(value || 0);
}

export function formatDateLabel(isoString, options = {}) {
  if (!isoString) {
    return 'TBD';
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    weekday: options.includeWeekday === false ? undefined : 'short',
    month: 'short',
    day: 'numeric',
    timeZone: options.timeZone || getViewerTimeZone()
  });

  return formatter.format(new Date(isoString));
}

export function formatTimeLabel(isoString, options = {}) {
  if (!isoString) {
    return 'TBD';
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: options.timeZone || getViewerTimeZone()
  });

  return formatter.format(new Date(isoString));
}

export function formatDateTimeLabel(isoString, options = {}) {
  if (!isoString) {
    return 'TBD';
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: options.timeZone || getViewerTimeZone()
  });

  return formatter.format(new Date(isoString));
}

export function formatLaReference(isoString) {
  return formatDateTimeLabel(isoString, { timeZone: 'America/Los_Angeles' });
}

export function formatUpdatedLabel(isoString) {
  if (!isoString) {
    return 'Awaiting first refresh';
  }

  return formatDateTimeLabel(isoString, { timeZone: 'UTC' }) + ' UTC';
}

export function formatDayKey(isoString) {
  if (!isoString) {
    return 'unknown';
  }

  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC'
  }).format(new Date(isoString));
}

export function formatStatusLabel(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'confirmed') return 'Confirmed';
  if (normalized === 'pending') return 'Pending draw or entry list';
  if (normalized === 'quota') return 'Quota place';
  if (normalized === 'named') return 'Named athlete';
  if (normalized === 'scheduled') return 'Scheduled';
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Unknown';
}
