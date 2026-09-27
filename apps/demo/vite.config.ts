import { foldkit } from "@foldkit/vite-plugin";
import { foldworksLayers, foldworksStylexTest } from "@foldworks/ui/vite";
import stylex from "@stylexjs/unplugin";
import { defineConfig } from "vite";
import { uiDocs } from "./ui-docs.ts";

export default defineConfig(({ mode }) => ({
  plugins:
    mode === "test"
      ? [foldworksStylexTest()]
      : [
          uiDocs(),
          stylex.vite({
            dev: mode === "development",
            runtimeInjection: false,
            useCSSLayers: { before: foldworksLayers },
          }),
          foldkit(),
        ],
  optimizeDeps: {
    entries: ["src/entry.ts"],
    exclude: [
      "@foldkit/ui",
      "@foldworks/agent",
      "@foldworks/code-editor",
      "@foldworks/data-grid",
      "@foldworks/diagram",
      "@foldworks/form-builder",
      "@foldworks/query-builder",
      "@foldworks/sidebar",
      "@foldworks/ui",
      "@foldworks/workflow",
      "effect",
      "foldkit",
    ],
  },
}));
