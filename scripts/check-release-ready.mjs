import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const changesetDirectory = join(repositoryRoot, ".changeset");
const pendingChangesets = (await readdir(changesetDirectory)).filter(
  (file) => file.endsWith(".md") && file.toLowerCase() !== "readme.md",
);

if (pendingChangesets.length > 0) {
  throw new Error(
    `Pending changesets must be applied before publishing: ${pendingChangesets.join(", ")}. Run pnpm version-packages first.`,
  );
}

const packageDirectory = join(repositoryRoot, "packages");
const placeholderVersions = [];
for (const entry of await readdir(packageDirectory, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  try {
    const manifest = JSON.parse(
      await readFile(join(packageDirectory, entry.name, "package.json"), "utf8"),
    );
    if (manifest.private !== true && manifest.name?.startsWith("@foldworks/") && manifest.version === "0.0.0") {
      placeholderVersions.push(manifest.name);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

if (placeholderVersions.length > 0) {
  throw new Error(`Refusing to publish placeholder versions: ${placeholderVersions.join(", ")}.`);
}

console.log("Release versions are ready to publish.");
