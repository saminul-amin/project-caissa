import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      enabled: true,
      exclude: ["src/**/*.test.ts", "src/test/**"],
      include: [
        "src/application/persistence/**/*.ts",
        "src/infrastructure/config/persistence-config.ts",
        "src/infrastructure/persistence/**/*.ts",
      ],
      provider: "v8",
      reporter: ["text", "json-summary"],
      thresholds: {
        branches: 80,
        functions: 85,
        lines: 85,
        statements: 85,
      },
    },
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
