interface PlaceholderPageProps {
  readonly description: string;
  readonly title: string;
}

export function PlaceholderPage({ description, title }: PlaceholderPageProps) {
  return (
    <section className="placeholder" aria-labelledby="page-title">
      <p className="eyebrow">Foundation placeholder</p>
      <h1 id="page-title">{title}</h1>
      <p>{description}</p>
      <p className="status-note" role="status">
        This route exists to verify navigation and architecture only.
      </p>
    </section>
  );
}
