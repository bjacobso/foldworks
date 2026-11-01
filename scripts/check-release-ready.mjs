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

const manifest = JSON.parse(
  await readFile(join(repositoryRoot, "packages", "foldworks", "package.json"), "utf8"),
);
if (manifest.version === "0.0.0") {
  throw new Error(`Refusing to publish the placeholder ${manifest.name}@0.0.0 version.`);
}

console.log("Release versions are ready to publish.");
