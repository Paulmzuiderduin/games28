export function getQualificationSportOptions(qualificationSources = []) {
  return [...new Set(qualificationSources.map((source) => source.sport).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

export function getQualificationEventOptions(qualificationSources = [], sport, sourceId = null) {
  if (!sport) return [];

  const matchingSources = sourceId
    ? qualificationSources.filter((source) => source.id === sourceId)
    : qualificationSources.filter((source) => source.sport === sport);
  const options = matchingSources
    .filter((source) => source.sport === sport)
    .flatMap((source) => source.qualificationEvents || []);

  return [...new Map(options.map((event) => [event.label, event])).values()]
    .sort((left, right) => left.label.localeCompare(right.label));
}
