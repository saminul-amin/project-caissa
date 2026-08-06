import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="state-card route-fade" aria-labelledby="not-found-title">
      <p className="eyebrow">Page not found</p>
      <h1 id="not-found-title">This square is outside the board</h1>
      <p>The page you requested does not exist. Your active game has not been changed.</p>
      <Link className="button button-primary" to="/">
        Return Home
      </Link>
    </section>
  );
}
