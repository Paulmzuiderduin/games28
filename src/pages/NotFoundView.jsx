import EmptyState from '../components/EmptyState.jsx';

export default function NotFoundView() {
  return (
    <section className="page-section">
      <div className="section-heading section-heading--flush">
        <div>
          <p className="eyebrow">404</p>
          <h1>That route is not wired yet</h1>
        </div>
      </div>
      <EmptyState
        title="Try the main routes"
        description="Open the home page, sports directory, schedule explorer, change feed, or a country dashboard from the directory."
      />
    </section>
  );
}
