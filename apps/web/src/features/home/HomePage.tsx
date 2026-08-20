import { Link } from "react-router-dom";

import { OPPONENT_STRENGTH_DISCLOSURE } from "../../application/opponent";
import { useCaissaApp } from "../../app/CaissaAppProvider";

export function HomePage() {
  const { activeGame } = useCaissaApp();
  return (
    <div className="home-page route-fade">
      <section className="hero" aria-labelledby="home-title">
        <p className="eyebrow">Play well. Understand why.</p>
        <h1 id="home-title">Play Chess Beyond the Best Move</h1>
        <p className="hero-description">
          Choose an opponent you can actually beat, play a complete game of chess, and afterwards
          see the handful of moments that decided it — all on your own device.
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
          <a className="button button-ghost" href="#how-caissa-works">
            How Caissa Works
          </a>
        </div>
        <p className="milestone-note" role="note">
          Nothing you play is uploaded. Games, settings, and analysis stay in this browser.
        </p>
      </section>

      <section className="product-principles" id="how-caissa-works" aria-labelledby="how-title">
        <div>
          <p className="eyebrow">Beyond evaluation</p>
          <h2 id="how-title">Chess software can be powerful without feeling cold.</h2>
        </div>
        <p>
          Caissa runs a full chess engine inside your browser. Six strength settings let you pick a
          game that is a fight rather than a rout, and every finished game can be replayed through
          the same engine to show where the result actually turned.
        </p>
        <p>
          Caissa tells you what the analysis found and stops there. It will not guess what you were
          thinking, and it does not claim to know your rating. {OPPONENT_STRENGTH_DISCLOSURE}
        </p>
      </section>
    </div>
  );
}
