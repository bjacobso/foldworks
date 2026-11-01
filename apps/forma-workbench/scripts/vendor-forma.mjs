import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  copyFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const app = fileURLToPath(new URL("../", import.meta.url));
const vendor = join(app, "vendor");
const manifestPath = join(vendor, "manifest.json");
const hash = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const run = (command, args, cwd) => execFileSync(command, args, { cwd, stdio: "inherit" });
const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

if (process.argv.includes("--check")) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const pkg = JSON.parse(readFileSync(join(app, "package.json"), "utf8"));
  for (const [name, entry] of Object.entries(manifest.packages)) {
    if (hash(join(vendor, entry.tarball)) !== entry.sha256) {
      throw new Error(`${name}: vendor checksum mismatch`);
    }
    if (pkg.dependencies[name] !== `file:vendor/${entry.tarball}`) {
      throw new Error(`${name}: app dependency does not match the vendor manifest`);
    }
  }
  console.log(`Verified Forma tarballs from ${manifest.commit}`);
} else {
  if (!process.env.FORMA_DIR) throw new Error("Set FORMA_DIR to an installed local Forma checkout");
  const forma = resolve(process.env.FORMA_DIR);
  const commit = git(forma, "rev-parse", "HEAD");
  if (git(forma, "status", "--porcelain")) {
    throw new Error("Forma checkout must be clean when building pinned tarballs");
  }
  // Do not install or modify the checkout's source. See the app README for setup.
  run("pnpm", ["--filter", "@formalang/ts", "--filter", "@formalang/host", "build"], forma);
  const temporary = mkdtempSync(join(tmpdir(), "foldworks-forma-"));
  const packages = {};
  const suffix = commit.slice(0, 7);
  const tsTarball = `formalang-ts-${suffix}.tgz`;
  try {
    mkdirSync(vendor, { recursive: true });
    for (const name of ["ts", "host"]) {
      const sourcePath = `packages/${name}`;
      const packed = join(temporary, name);
      mkdirSync(packed);
      run("pnpm", ["pack", "--pack-destination", packed], join(forma, sourcePath));
      const original = join(
        packed,
        readdirSync(packed).find((file) => file.endsWith(".tgz")),
      );
      run("tar", ["-xzf", original, "-C", packed], forma);
      const staged = join(packed, "package");
      const packagePath = join(staged, "package.json");
      const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
      // pnpm resolves transitive file references from the consuming workspace app.
      // Keep the host on the same pinned engine instead of the registry's old 0.3.0.
      if (name === "host") pkg.dependencies["@formalang/ts"] = `file:vendor/${tsTarball}`;
      writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
      run("pnpm", ["pack", "--pack-destination", packed], staged);
      const tarball = `formalang-${name}-${suffix}.tgz`;
      copyFileSync(join(packed, basename(original)), join(vendor, tarball));
      packages[pkg.name] = { commit, sourcePath, tarball, sha256: hash(join(vendor, tarball)) };
    }
    writeFileSync(
      manifestPath,
      `${JSON.stringify(
        {
          repository: "https://github.com/bjacobso/forma",
          commit,
          packages,
          packaging:
            "pnpm pack; host dependency on @formalang/ts rewritten to the app-local pinned engine tarball",
        },
        null,
        2,
      )}\n`,
    );
    const packagePath = join(app, "package.json");
    const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
    for (const [name, entry] of Object.entries(packages)) {
      pkg.dependencies[name] = `file:vendor/${entry.tarball}`;
    }
    writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
    console.log(
      "Refreshed Forma vendor manifest. Run pnpm install --no-frozen-lockfile and pnpm check.",
    );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
