import { foldkit } from "@foldkit/vite-plugin";
import { foldworksLayers } from "@foldworks/ui/vite";
import stylex from "@stylexjs/unplugin";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  base: "/forma/",
  plugins: [
    stylex.vite({
      dev: mode === "development",
      runtimeInjection: false,
      useCSSLayers: { before: foldworksLayers },
    }),
    foldkit(),
  ],
  build: {
    sourcemap: true,
  },
  optimizeDeps: {
    entries: ["src/main.ts"],
    // Foldworks packages ship StyleX; the plugin transforms them, so Vite must not prebundle them.
    exclude: [
      "@foldkit/ui",
      "@foldworks/agent",
      "@foldworks/code-editor",
      "@foldworks/outliner",
      "@foldworks/text-intelligence",
      "@foldworks/ui",
      "effect",
      "foldkit",
    ],
  },
}));
