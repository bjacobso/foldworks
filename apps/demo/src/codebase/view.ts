import { Box, FileText, FolderGit2, Search, type LucideIconData } from "@lucide/icons";
import { Badge, Icon, sxAttrs } from "@foldworks/ui";
import type { Html, HtmlBuilder } from "foldkit/html";

import { styles as s } from "./styles";

const navItem = <Message>(
  label: string,
  icon: LucideIconData,
  selected: boolean,
  h: HtmlBuilder<Message>,
): Html => h.div(sxAttrs(h, s.navItem, selected && s.navSelected), [
  Icon.view({ icon, size: 12 }, h),
  h.span(sxAttrs(h, s.navText), [label]),
]);

type DiffTone = "plain" | "file" | "hunk" | "added" | "removed";

const diffLine = <Message>(
  number: string,
  code: string,
  tone: DiffTone,
  h: HtmlBuilder<Message>,
): Html => h.span(sxAttrs(
  h,
  s.line,
  tone === "file" && s.fileLine,
  tone === "hunk" && s.hunkLine,
  tone === "added" && s.addedLine,
  tone === "removed" && s.removedLine,
), [
  h.span(sxAttrs(h, s.lineNumber), [number]),
  h.span(sxAttrs(h, s.lineCode), [code.length === 0 ? " " : code]),
]);

const fact = <Message>(label: string, value: string, h: HtmlBuilder<Message>): Html =>
  h.div(sxAttrs(h, s.fact), [
    h.span([], [label]),
    h.span(sxAttrs(h, s.factValue), [value]),
  ]);

export const view = <Message>(h: HtmlBuilder<Message>): Html => h.div(sxAttrs(h, s.root), [
  h.div(sxAttrs(h, s.intro), [
    h.div(sxAttrs(h, s.introCopy), [
      h.div(sxAttrs(h, s.eyebrow), ["Project workspace example"]),
      h.h2(sxAttrs(h, s.introTitle), ["Explore a repository as living documentation."]),
      h.p(sxAttrs(h, s.introText), [
        "The source-backed server indexes packages, Markdown, history, and the working tree. This deterministic fixture shows the same workbench without requiring a Git checkout in the browser.",
      ]),
    ]),
    h.div(sxAttrs(h, s.live), [h.span(sxAttrs(h, s.liveDot), []), "Repository connected"]),
  ]),
  h.section(sxAttrs(h, s.workbench), [
    h.aside([...sxAttrs(h, s.sidebar), h.AriaLabel("Repository navigation")], [
      h.div(sxAttrs(h, s.repo), [
        h.span(sxAttrs(h, s.repoIcon), [Icon.view({ icon: FolderGit2, size: 14 }, h)]),
        "foldworks",
      ]),
      h.div(sxAttrs(h, s.search), [Icon.view({ icon: Search, size: 13 }, h), "Search repository…"]),
      h.div(sxAttrs(h, s.switcher), [
        h.span(sxAttrs(h, s.switchItem, s.switchActive), ["Packages"]),
        h.span(sxAttrs(h, s.switchItem), ["Files"]),
        h.span(sxAttrs(h, s.switchItem), ["Changes"]),
      ]),
      h.div(sxAttrs(h, s.sectionLabel), ["Workspace packages"]),
      h.nav(sxAttrs(h, s.nav), [
        navItem("foldworks", Box, false, h),
        navItem("@foldworks/agent", Box, false, h),
        navItem("@foldworks/code-editor", Box, false, h),
        navItem("@foldworks/codebase", Box, true, h),
        navItem("@foldworks/data-grid", Box, false, h),
        navItem("@foldworks/editor", Box, false, h),
        navItem("@foldworks/ui", Box, false, h),
      ]),
      h.div(sxAttrs(h, s.sectionLabel), ["Documentation"]),
      h.nav(sxAttrs(h, s.nav), [
        navItem("Repository overview", FileText, false, h),
        navItem("Codebase overview", FileText, false, h),
        navItem("Workbench guide", FileText, false, h),
      ]),
    ]),
    h.div(sxAttrs(h, s.main), [
      h.div(sxAttrs(h, s.mainHeader), [
        h.span(sxAttrs(h, s.path), ["@foldworks/codebase / changes"]),
        h.div(sxAttrs(h, s.tabs), [
          h.span(sxAttrs(h, s.tab), ["Overview"]),
          h.span(sxAttrs(h, s.tab), ["Source"]),
          h.span(sxAttrs(h, s.tab, s.tabActive), ["Changes"]),
          h.span(sxAttrs(h, s.tab), ["History"]),
        ]),
      ]),
      h.div(sxAttrs(h, s.content), [
        h.div(sxAttrs(h, s.diffSwitcher), [
          h.span(sxAttrs(h, s.tab), ["Unstaged"]),
          h.span(sxAttrs(h, s.tab, s.tabActive), ["Staged"]),
          h.span(sxAttrs(h, s.tab), ["Branch"]),
        ]),
        h.div(sxAttrs(h, s.codeCard), [
          h.div(sxAttrs(h, s.codeHeader), [
            h.span([], ["staged · packages/codebase"]),
            h.span([], ["base origin/main"]),
          ]),
          h.pre(sxAttrs(h, s.code), [
            diffLine("1", "diff --git a/packages/codebase/src/server.ts b/packages/codebase/src/server.ts", "file", h),
            diffLine("2", "index 1b5c13a..fc2268a 100644", "plain", h),
            diffLine("3", "--- a/packages/codebase/src/server.ts", "plain", h),
            diffLine("4", "+++ b/packages/codebase/src/server.ts", "plain", h),
            diffLine("5", "@@ -54,6 +54,12 @@ export const startCodebaseServer = async", "hunk", h),
            diffLine("6", "   const config = await resolveCodebaseConfig(input);", "plain", h),
            diffLine("7", "+  const clients = new Set<ServerResponse>();", "added", h),
            diffLine("8", "+  const watchers: FSWatcher[] = [];", "added", h),
            diffLine("9", "   let cachedSnapshot: RepositorySnapshot | undefined;", "plain", h),
            diffLine("10", "", "plain", h),
            diffLine("11", "-  return createServer(handler);", "removed", h),
            diffLine("12", "+  return listen({ server, config, watchers, clients });", "added", h),
            diffLine("13", " }", "plain", h),
            diffLine("14", "", "plain", h),
            diffLine("15", "diff --git a/.conductor/settings.toml b/.conductor/settings.toml", "file", h),
            diffLine("16", "@@ -0,0 +1,4 @@", "hunk", h),
            diffLine("17", "+[scripts.run.codebase]", "added", h),
            diffLine("18", "+command = \"pnpm codebase --host 0.0.0.0\"", "added", h),
          ]),
        ]),
      ]),
    ]),
    h.aside([...sxAttrs(h, s.inspector), h.AriaLabel("Repository context")], [
      h.div([], [
        h.h3(sxAttrs(h, s.inspectorTitle), ["@foldworks/codebase"]),
        h.p(sxAttrs(h, s.inspectorText), ["Live repository documentation, source, history, and Git diffs."]),
      ]),
      h.div(sxAttrs(h, s.factGroup), [
        h.div(sxAttrs(h, s.factTitle), ["Repository"]),
        fact("Branch", "feature/codebase", h),
        fact("Revision", "881385b", h),
        fact("Base", "origin/main", h),
      ]),
      h.div([], [
        h.div(sxAttrs(h, s.factTitle), ["Working tree"]),
        h.div(sxAttrs(h, s.chips), [
          h.span(sxAttrs(h, s.chip), ["3 staged"]),
          h.span(sxAttrs(h, s.chip), ["1 modified"]),
        ]),
      ]),
      h.div([], [
        h.div(sxAttrs(h, s.factTitle), ["Package"]),
        fact("Path", "packages/codebase", h),
        fact("Documents", "1", h),
        fact("Mode", "read-only", h),
      ]),
      h.div([], [
        h.div(sxAttrs(h, s.factTitle), ["Capabilities"]),
        h.div(sxAttrs(h, s.chips), [
          Badge.view({ label: "Live refresh", tone: "success", dot: true }, h),
          Badge.view({ label: "Safe paths" }, h),
          Badge.view({ label: "Git history" }, h),
        ]),
      ]),
    ]),
  ]),
  h.p(sxAttrs(h, s.footnote), [
    "Run the source-backed version inside any checkout with ",
    h.code(sxAttrs(h, s.command), ["pnpm codebase"]),
    ". In a remote sandbox, bind to ",
    h.code(sxAttrs(h, s.command), ["0.0.0.0"]),
    " and use its authenticated port forwarding.",
  ]),
]);
