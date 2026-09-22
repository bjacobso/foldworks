import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const lockfile = await readFile("pnpm-lock.yaml");
const installedLockfile = await readFile("node_modules/.pnpm/lock.yaml").catch(() => undefined);

if (installedLockfile?.equals(lockfile)) {
  console.log("Dependencies are up to date.");
  process.exit(0);
}

console.log("Installing workspace dependencies...");
const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(command, ["install", "--frozen-lockfile"], { stdio: "inherit" });

if (result.error) {
  console.error(`Could not start pnpm: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
