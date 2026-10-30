import { getSportGroup } from './sport-groups.js';

function sourceSports(source) {
  return [source?.sport, ...(source?.sports || [])].filter(Boolean).map(getSportGroup);
}

export function getQualificationSportOptions(qualificationSources = []) {
  return [...new Set(qualificationSources.flatMap(sourceSports))].sort((left, right) => left.localeCompare(right));
}

export function getQualificationEventOptions(qualificationSources = [], sport, sourceId = null) {
  if (!sport) return [];
  const targetSport = getSportGroup(sport);
  const matchingSources = sourceId
    ? qualificationSources.filter((source) => source.id === sourceId)
    : qualificationSources.filter((source) => sourceSports(source).includes(targetSport));
  const options = matchingSources.flatMap((source) =>
    (source.qualificationEvents || []).filter((event) => {
      const eventSports = (event.sports || []).map(getSportGroup);
      return eventSports.length ? eventSports.includes(targetSport) : sourceSports(source).includes(targetSport);
    })
  );

  return [...new Map(options.map((event) => [event.label, event])).values()].sort((left, right) =>
    left.label.localeCompare(right.label)
  );
}
