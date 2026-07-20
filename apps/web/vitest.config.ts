import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      enabled: true,
      exclude: ["src/**/*.test.ts", "src/test/**"],
      include: [
        "src/application/bootstrap/**/*.ts",
        "src/application/game-session/**/*.ts",
        "src/application/history/**/*.ts",
        "src/application/persistence/**/*.ts",
        "src/application/recovery/**/*.ts",
        "src/infrastructure/config/persistence-config.ts",
        "src/infrastructure/persistence/**/*.ts",
      ],
      provider: "v8",
      reporter: ["text", "json-summary"],
      thresholds: {
        "src/application/{bootstrap,game-session,history,recovery}/**/*.ts": {
          branches: 85,
          functions: 90,
          lines: 88,
          statements: 88,
        },
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
