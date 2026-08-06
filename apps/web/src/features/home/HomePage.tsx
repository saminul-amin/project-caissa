import { Link } from "react-router-dom";

import { useCaissaApp } from "../../app/CaissaAppProvider";

export function HomePage() {
  const { activeGame } = useCaissaApp();
  return (
    <div className="home-page route-fade">
      <section className="hero" aria-labelledby="home-title">
        <p className="eyebrow">Human-like chess. Meaningful improvement.</p>
        <h1 id="home-title">Play Chess Beyond the Best Move</h1>
        <p className="hero-description">
          Face human-like opponents, understand the decisions behind your games, and improve through
          analysis designed for people—not machines.
        </p>
        <div className="hero-actions">
          {activeGame ? (
            <Link className="button button-primary" to="/play">
              Resume Game
            </Link>
          ) : null}
          <Link
            className={activeGame ? "button button-secondary" : "button button-primary"}
            to="/play/new"
          >
            Play a Game
          </Link>
          <a className="button button-ghost" href="#human-like-ai">
            Discover Human-Like AI
          </a>
        </div>
        <p className="milestone-note" role="note">
          Local two-player setup is available in this milestone. AI opponents are described below
          but are not playable yet.
        </p>
      </section>

      <section className="product-principles" id="human-like-ai" aria-labelledby="ai-title">
        <div>
          <p className="eyebrow">Beyond evaluation</p>
          <h2 id="ai-title">Chess software can be powerful without feeling cold.</h2>
        </div>
        <p>
          Caissa is being built to pair reliable chess analysis with the context of how people
          actually decide. Human-like AI and guided review remain future milestones; this release
          begins with a correct, private, local foundation.
        </p>
      </section>
    </div>
  );
}
