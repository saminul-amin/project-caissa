import { Link } from "react-router-dom";

interface PlaceholderPageProps {
  readonly description: string;
  readonly title: string;
}

export function PlaceholderPage({ description, title }: PlaceholderPageProps) {
  return (
    <section className="state-card route-fade" aria-labelledby="placeholder-title">
      <p className="eyebrow">Future milestone</p>
      <h1 id="placeholder-title">{title}</h1>
      <p>{description}</p>
      <Link className="button button-secondary" to="/">
        Return Home
      </Link>
    </section>
  );
}
