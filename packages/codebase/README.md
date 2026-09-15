# @foldworks/codebase

A live, read-only web workbench for exploring a checked-out Git repository.
It indexes workspace packages and Markdown documentation, displays bounded text
files, follows file changes, shows file history, and renders staged, unstaged,
or branch diffs. Repository files remain the source of truth; the workbench does
not create a parallel documentation database.

```sh
pnpm add -D @foldworks/codebase
foldworks-codebase --root .
```

Or start it programmatically:

```ts
import { startCodebaseServer } from "@foldworks/codebase/server";

const workbench = await startCodebaseServer({
  root: process.cwd(),
  title: "Payments service",
  baseRef: "origin/main",
  host: "127.0.0.1",
  port: 4310,
});

console.log(workbench.origin);
```

The command accepts `--root`, `--title`, `--base-ref`, `--host`, `--port`, and
`--max-file-size`. Use `--host 0.0.0.0` inside a remote development sandbox so
its normal port-forwarding facility can detect the listener.

## What it indexes

- files known to Git plus untracked, non-ignored files;
- package manifests and their dependencies;
- repository and package READMEs plus other Markdown documents;
- the current branch, revision, and porcelain working-tree status;
- commit history for a selected path;
- staged (`index → HEAD`), unstaged (`worktree → index`), and branch-base diffs.

The browser receives a serializable repository snapshot and uses server-sent
events to refresh it after filesystem or Git index changes. Direct links use a
hash route, so files and packages can be bookmarked without special server
routing.

## Security boundary

The server is intentionally read-only. It executes a fixed set of Git inspection
commands and has no general command endpoint. File paths are resolved inside the
configured repository; `.git`, `node_modules`, and `.env*` reads are denied,
binary files are rejected, and text reads default to a 1 MiB limit.

The default listener is `127.0.0.1`. Only bind to `0.0.0.0` behind a trusted,
authenticated development tunnel.
