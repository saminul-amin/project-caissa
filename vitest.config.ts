import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      enabled: true,
      include: ["packages/*/src/**/*.{ts,tsx}", "apps/web/src/**/*.{ts,tsx}"],
      provider: "v8",
      reporter: ["text", "json-summary"],
    },
    include: ["apps/**/*.test.{ts,tsx}", "packages/**/*.test.{ts,tsx}"],
    passWithNoTests: false,
  },
});
