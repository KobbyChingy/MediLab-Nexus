type PortalDashboardItem = {
  key: string;
  label: string;
  short: string;
  description: string;
};

type PortalSnapshotCard = {
  label: string;
  value: string | number;
  note: string;
};

export function PortalDashboardDeck(props: {
  label: string;
  spotlight: string;
  highlights: string[];
  items: PortalDashboardItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  steps: string[];
  snapshotCards: PortalSnapshotCard[];
}) {
  const {
    label,
    spotlight,
    highlights,
    items,
    activeKey,
    onSelect,
    steps,
    snapshotCards,
  } = props;

  return (
    <section className="portal-grid">
      <article className="surface-card portal-panel">
        <div className="section-head">
          <div>
            <h3>{label}</h3>
            <p>{spotlight}</p>
          </div>
          <span className="portal-badge">Portal-ready</span>
        </div>
        <div className="portal-highlight-row">
          {highlights.map((highlight) => (
            <span key={highlight} className="portal-highlight-chip">
              {highlight}
            </span>
          ))}
        </div>
        <div className="portal-menu-grid">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`portal-menu-card ${activeKey === item.key ? "active" : ""}`}
              onClick={() => onSelect(item.key)}
            >
              <span className="nav-icon">{item.short}</span>
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </div>
      </article>

      <article className="surface-card portal-playbook-card">
        <div className="section-head">
          <div>
            <h3>Portal playbook</h3>
            <p>
              Use these steps to move through the portal without losing
              operational context.
            </p>
          </div>
        </div>
        <div className="portal-step-list">
          {steps.map((step) => (
            <article key={step} className="portal-step-card">
              <strong>{step}</strong>
            </article>
          ))}
        </div>
        <div className="portal-snapshot-grid">
          {snapshotCards.map((card) => (
            <article key={card.label} className="portal-snapshot-card">
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <p>{card.note}</p>
            </article>
          ))}
        </div>
      </article>
    </section>
  );
}

export function PortalBriefingRail(props: {
  label: string;
  spotlight: string;
  highlights: string[];
  snapshotCards: PortalSnapshotCard[];
}) {
  const { label, spotlight, highlights, snapshotCards } = props;

  return (
    <article className="surface-card rail-card portal-briefing-card">
      <div className="section-head">
        <div>
          <h3>{label}</h3>
          <p>{spotlight}</p>
        </div>
      </div>
      <div className="portal-rail-highlights">
        {highlights.slice(0, 4).map((highlight) => (
          <span key={highlight} className="portal-highlight-chip compact">
            {highlight}
          </span>
        ))}
      </div>
      <div className="portal-rail-metrics">
        {snapshotCards.map((card) => (
          <article key={`rail-${card.label}`} className="portal-rail-metric">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.note}</small>
          </article>
        ))}
      </div>
    </article>
  );
}
