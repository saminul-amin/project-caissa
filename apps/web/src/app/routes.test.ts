import { describe, expect, it } from "vitest";

import { APP_ROUTES } from "./routes";

describe("application routes", () => {
  it("defines each Phase 1 placeholder route once", () => {
    expect(APP_ROUTES.map((route) => route.path)).toEqual([
      "/",
      "/play",
      "/review",
      "/history",
      "/settings",
    ]);
  });

  it("marks every route as not implemented", () => {
    expect(
      APP_ROUTES.every((route) => route.description.includes("not been implemented yet")),
    ).toBe(true);
  });
});
