function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function genderFromText(value) {
  const text = normalizeText(value);
  if (/(^| )(women|woman|female)( |$)/.test(text)) return 'women';
  if (/(^| )(men|man|male)( |$)/.test(text)) return 'men';
  return null;
}

const GENERIC_EVENT_WORDS = new Set([
  'men', 'man', 'male', 'women', 'woman', 'female', 'tournament', 'team',
  'individual', 'olympic', 'olympics', 'la28', 'qualification', 'event'
]);

function meaningfulWords(value, sport) {
  const sportWords = new Set(normalizeText(sport).split(' ').filter(Boolean));
  return normalizeText(value)
    .split(' ')
    .filter((word) => word && !GENERIC_EVENT_WORDS.has(word) && !sportWords.has(word));
}

function eventCandidates(record, sources) {
  return (sources || []).flatMap((source) => (source.qualificationEvents || [])
    .filter((event) => (event.sports || []).includes(record.sport))
    .map((event) => ({
      key: `${source.qualificationSystemKey || source.id}:${event.key}`,
      label: event.label,
      sourceId: source.id,
      event
    })));
}

// A qualification source may use editorial wording while the registry owns the
// public event vocabulary. Resolve only unambiguous matches, never guess.
export function resolveCanonicalQualificationEvent(record, sources) {
  let candidates = eventCandidates(record, sources);
  if (!candidates.length) return null;

  const evidence = [...(record.disciplines || []), ...(record.events || [])].join(' ');
  const gender = genderFromText(evidence);
  if (gender) {
    const genderMatches = candidates.filter((candidate) => genderFromText(candidate.label) === gender);
    if (genderMatches.length) candidates = genderMatches;
  }

  const evidenceWords = new Set(meaningfulWords(evidence, record.sport));
  if (evidenceWords.size) {
    const scored = candidates.map((candidate) => ({
      candidate,
      score: meaningfulWords(candidate.label, record.sport)
        .filter((word) => evidenceWords.has(word)).length
    }));
    const highScore = Math.max(...scored.map(({ score }) => score));
    if (highScore > 0) candidates = scored
      .filter(({ score }) => score === highScore)
      .map(({ candidate }) => candidate);
  }

  const uniqueCandidates = [...new Map(candidates.map((candidate) => [candidate.key, candidate])).values()];
  return uniqueCandidates.length === 1 ? uniqueCandidates[0] : null;
}

export function formatCanonicalEventLabel(label, sport) {
  const prefix = `${sport} - `;
  return label?.startsWith(prefix) ? label.slice(prefix.length) : label || null;
}
