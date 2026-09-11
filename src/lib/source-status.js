export function officialCheckStatus(meta = {}) {
  if (meta.scheduleAuthority === 'stale_official') return {
    value: 'Using last good schedule',
    detail: 'The latest refresh could not publish a verified official update. The previous official schedule remains available.'
  };
  if (meta.officialValidation?.passed && meta.scheduleAuthority === 'official_pdf') return {
    value: 'Passed',
    detail: 'The official PDF is the published schedule source. Automatic validation checks continue on every refresh.'
  };
  const target = 3;
  const count = Math.min(target, Math.max(0, Math.floor(Number(meta.officialShadowSuccessStreak) || 0)));
  return meta.officialValidation?.passed ? {
    value: 'Validation passed',
    detail: `${count} of ${target} successful checks completed before switching to the official PDF. The community schedule is still published.`
  } : {
    value: 'Needs review',
    detail: meta.officialValidation?.issues?.[0] || 'The official update has not passed validation. The published schedule has not been replaced.'
  };
}
