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
      name: "ui-does-not-import-raw-repository-ports",
      severity: "error",
      from: { path: "^apps/web/src/(features|ui)/" },
      to: { path: "^apps/web/src/application/persistence/" },
    },
    {
      name: "external-board-library-is-adapter-only",
      severity: "error",
      from: {
        path: "^apps/web/src/",
        pathNot: "^apps/web/src/features/game-shell/components/ChessBoardAdapter\\.tsx$",
      },
      to: { path: "node_modules/react-chessboard(/|$)" },
    },
    {
      name: "board-adapter-does-not-import-application-services",
      severity: "error",
      from: {
        path: "^apps/web/src/features/game-shell/components/ChessBoardAdapter\\.tsx$",
      },
      to: { path: "^apps/web/src/application/" },
    },
    {
      name: "setup-does-not-construct-game-controller",
      severity: "error",
      from: { path: "^apps/web/src/features/game-setup/" },
      to: { path: "^packages/chess-core/src/(game-controller|rules)/" },
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
      name: "persistence-infrastructure-does-not-import-react",
      severity: "error",
      from: { path: "^apps/web/src/infrastructure/persistence/" },
      to: { path: "node_modules/(react|react-dom|zustand)(/|$)" },
    },
    {
      name: "application-services-do-not-import-storage-records",
      severity: "error",
      from: {
        path: "^apps/web/src/application/(bootstrap|game-session|history|recovery)/",
      },
      to: {
        path: "^apps/web/src/infrastructure/persistence/(database|schema|storage-records|migrations)",
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
