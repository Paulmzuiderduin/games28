export default function EmptyState({ title, description, compact = false, children = null }) {
  return (
    <div className={`empty-state ${compact ? 'empty-state--compact' : ''}`}>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
