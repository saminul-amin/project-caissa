import { Navigate, Route, Routes } from "react-router-dom";

import { APP_ROUTES } from "./routes";
import { AppShell } from "../ui/layout/AppShell";
import { PlaceholderPage } from "../ui/pages/PlaceholderPage";

export function App() {
  return (
    <AppShell>
      <Routes>
        {APP_ROUTES.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={<PlaceholderPage description={route.description} title={route.label} />}
          />
        ))}
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </AppShell>
  );
}
