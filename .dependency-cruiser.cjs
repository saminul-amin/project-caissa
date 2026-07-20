/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Circular dependencies make state ownership and initialization ambiguous.",
      from: {},
      to: { circular: true },
    },
    {
      name: "packages-do-not-import-apps",
      severity: "error",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
    },
    {
      name: "chess-core-is-framework-independent",
      severity: "error",
      from: { path: "^packages/chess-core/" },
      to: {
        path: "(^apps/|node_modules/(react|react-dom|zustand|dexie|fastapi)(/|$))",
      },
    },
    {
      name: "ui-does-not-import-persistence-implementations",
      severity: "error",
      from: { path: "^apps/web/src/(features|ui)/" },
      to: { path: "^apps/web/src/infrastructure/(db|persistence|storage)/" },
    },
    {
      name: "application-ports-do-not-import-persistence-infrastructure",
      severity: "error",
      from: { path: "^apps/web/src/application/" },
      to: {
        path: "(^apps/web/src/infrastructure/persistence/|node_modules/dexie(/|$))",
      },
    },
    {
      name: "dexie-is-persistence-infrastructure-only",
      severity: "error",
      from: {
        path: "^apps/web/src/",
        pathNot: "^apps/web/src/infrastructure/persistence/",
      },
      to: { path: "node_modules/dexie(/|$)" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: "(^|/)(dist|coverage)/",
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.base.json" },
  },
};
