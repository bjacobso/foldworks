import { foldkit } from "@foldkit/vite-plugin";
import { foldworksLayers, foldworksStylexTest } from "@foldworks/ui/vite";
import stylex from "@stylexjs/unplugin";
import { defineConfig } from "vite";
import { formaWorkbench } from "./forma-workbench.ts";
import { moduleDocs } from "./docs/plugin.ts";
import { uiDocs } from "./ui-docs.ts";

export default defineConfig(({ mode }) => ({
  plugins:
    mode === "test"
      ? [foldworksStylexTest()]
      : [
          formaWorkbench(),
          uiDocs(),
          moduleDocs(),
          stylex.vite({
            dev: mode === "development",
            runtimeInjection: false,
            useCSSLayers: { before: foldworksLayers },
          }),
          foldkit(),
        ],
  test: { css: { include: [/base\.css/] } },
  optimizeDeps: {
    entries: ["src/entry.ts"],
    exclude: [
      "@foldkit/ui",
      "@foldworks/agent",
      "@foldworks/code-editor",
      "@foldworks/data-grid",
      "@foldworks/diagram",
      "@foldworks/form-builder",
      "@foldworks/outliner",
      "@foldworks/query-builder",
      "@foldworks/sidebar",
      "@foldworks/text-intelligence",
      "@foldworks/ui",
      "@foldworks/workflow",
      "effect",
      "foldkit",
    ],
  },
}));
