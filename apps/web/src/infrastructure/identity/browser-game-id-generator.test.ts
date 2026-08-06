import { describe, expect, it } from "vitest";

import { BrowserGameIdGenerator } from "./browser-game-id-generator";

describe("BrowserGameIdGenerator", () => {
  it("isolates secure UUID generation and returns a validated GameId", () => {
    const generator = new BrowserGameIdGenerator({
      randomUUID: () => "8a1df584-3ea9-451a-9084-d4a8b0fe77ec",
    });
    expect(generator.create()).toBe("8a1df584-3ea9-451a-9084-d4a8b0fe77ec");
  });

  it("rejects invalid platform output", () => {
    const generator = new BrowserGameIdGenerator({ randomUUID: () => "not a valid id" });
    expect(() => generator.create()).toThrow();
  });
});
