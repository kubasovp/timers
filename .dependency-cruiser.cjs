/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "kernel-is-domain-neutral",
      severity: "error",
      from: { path: "^src/kernel" },
      to: {
        path: "^src/(features|platform)|^(vue|@tauri-apps/|better-sqlite3|sqlite3)"
      }
    },
    {
      name: "feature-domain-is-pure",
      severity: "error",
      from: { path: "^src/features/[^/]+/domain" },
      to: { path: "^(vue|@tauri-apps/|better-sqlite3|sqlite3)" }
    },
    {
      name: "feature-use-cases-do-not-use-ui-or-tauri",
      severity: "error",
      from: { path: "^src/features/[^/]+/use-cases" },
      to: { path: "^(vue|@tauri-apps/)" }
    },
    {
      name: "features-do-not-import-other-feature-internals",
      severity: "error",
      from: { path: "^src/features/custom-timer" },
      to: {
        path: "^src/features/(?!custom-timer(?:/|$))[^/]+/.+"
      }
    },
    {
      name: "scheduler-loop-does-not-import-feature-ui",
      severity: "error",
      from: { path: "^src/platform/scheduler-loop" },
      to: { path: "^src/features/[^/]+/ui" }
    }
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.app.json" },
    enhancedResolveOptions: {
      extensions: [".ts", ".tsx", ".vue", ".js", ".mjs", ".json"]
    },
    reporterOptions: {
      dot: {
        collapsePattern: "node_modules/[^/]+"
      }
    }
  }
};
