export function formatChangeEntityLabel(change) {
  if (change.entityType === 'schedule_entry') return 'Schedule';
  if (change.entityType === 'athlete_card') return 'Qualification';
  return change.entityType || 'Update';
}
