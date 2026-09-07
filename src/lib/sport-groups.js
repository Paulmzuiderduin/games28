// Source schedule stages are not separate sports. Keep raw records intact.
export function getSportGroup(sport) {
  return ['Boxing - Final Stages', 'Boxing - Preliminary Stages'].includes(sport) ? 'Boxing' : sport;
}
