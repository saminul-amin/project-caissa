import { describe, expect, it } from "vitest";

import { healthResponseSchema } from "./health";

describe("health response contract", () => {
  it("accepts the versioned service health payload", () => {
    expect(
      healthResponseSchema.parse({
        serviceName: "caissa-maia-service",
        serviceVersion: "0.1.0",
        status: "ok",
        environment: "test",
      }),
    ).toEqual({
      serviceName: "caissa-maia-service",
      serviceVersion: "0.1.0",
      status: "ok",
      environment: "test",
    });
  });

  it("rejects unrecognized environments and additional fields", () => {
    expect(() =>
      healthResponseSchema.parse({
        serviceName: "caissa-maia-service",
        serviceVersion: "0.1.0",
        status: "ok",
        environment: "unknown",
        secret: "must-not-cross-the-contract",
      }),
    ).toThrow();
  });
});
