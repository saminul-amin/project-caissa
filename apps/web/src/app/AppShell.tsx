import type { PropsWithChildren } from "react";
import { Link, NavLink } from "react-router-dom";

import { APP_ROUTES } from "./routes";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="app-header">
        <Link className="brand-lockup" to="/" aria-label="Caissa home">
          <span className="brand-name">Caissa</span>
          <span className="brand-slogan">Beyond the Best Move</span>
        </Link>
        <nav aria-label="Primary navigation">
          <ul className="primary-navigation">
            {APP_ROUTES.map((route) => (
              <li key={route.path}>
                <NavLink
                  className={({ isActive }) =>
                    isActive ? "navigation-link is-active" : "navigation-link"
                  }
                  end={route.path === "/"}
                  to={route.path}
                >
                  {route.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="app-main" id="main-content" tabIndex={-1}>
        {children}
      </main>
      <footer className="app-footer">
        <p>Local-first by design · Your active game stays in this browser.</p>
      </footer>
    </div>
  );
}
