import { existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));
const targetDir = join(rootDir, "..", "src-tauri", "target");
let removedCount = 0;

removeCodegenAssets(targetDir);

if (removedCount > 0) {
  console.log(`Removed ${removedCount} stale Tauri codegen asset director${removedCount === 1 ? "y" : "ies"}.`);
}

function removeCodegenAssets(directory) {
  if (!existsSync(directory)) {
    return;
  }

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const child = join(directory, entry.name);

    if (entry.name === "tauri-codegen-assets") {
      rmSync(child, { recursive: true, force: true });
      removedCount += 1;
      continue;
    }

    removeCodegenAssets(child);
  }
}
