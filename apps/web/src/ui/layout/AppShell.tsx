import type { PropsWithChildren } from "react";
import { NavLink } from "react-router-dom";

import { APP_ROUTES } from "../../app/routes";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="app-header">
        <div className="brand-lockup" aria-label="Caissa">
          <span className="brand-name">Caissa</span>
          <span className="brand-slogan">Beyond the Best Move</span>
        </div>
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
        <p>Phase 1 foundation · No chess or AI features are active.</p>
      </footer>
    </div>
  );
}
