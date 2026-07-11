import { describe, expect, it } from "vitest";

import { CHESS_CORE_VERSION } from "./index";

describe("chess core public API", () => {
  it("exports the foundation package version", () => {
    expect(CHESS_CORE_VERSION).toBe("0.1.0");
  });
});
