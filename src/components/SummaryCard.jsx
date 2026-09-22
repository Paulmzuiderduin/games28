export default function SummaryCard({ label, value, detail }) {
  return (
    <article className="summary-card">
      <p className="eyebrow">{label}</p>
      <strong>{typeof value === 'number' ? formatCount(value) : value}</strong>
      {detail ? <span>{detail}</span> : null}
    </article>
  );
}
