import { describe, expect, it } from "vitest";

import { APP_ROUTES } from "./routes";

describe("application routes", () => {
  it("exposes the intentional primary navigation routes once", () => {
    expect(APP_ROUTES.map((route) => route.path)).toEqual([
      "/",
      "/play/new",
      "/history",
      "/settings",
    ]);
  });
});
