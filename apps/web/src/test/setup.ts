import "@testing-library/jest-dom/vitest";

import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * Testing Library's async helpers default to a one-second ceiling, which is independent of
 * the Vitest test timeout. Route-level screens are lazily imported, and resolving that
 * import under parallel workers with coverage instrumentation can exceed one second. The
 * assertions are about behaviour, not speed, so the ceiling is raised rather than leaving
 * the suite intermittently red.
 */
configure({ asyncUtilTimeout: 5_000 });

afterEach(() => {
  cleanup();
});
