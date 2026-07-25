export function PlaceholderPage({ title, description, icon = "◫" }) {
  return (
    <section className="platform-page">
      <div className="page-heading">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>

      <div className="placeholder-page-content">
        <div className="placeholder-page-icon">{icon}</div>
        <h2>{title}</h2>
        <p>This Cradle function will be developed next.</p>
      </div>
    </section>
  );
}
