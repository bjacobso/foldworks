import { foldkit } from "@foldkit/vite-plugin";
import { foldworksLayers } from "@foldworks/ui/vite";
import stylex from "@stylexjs/unplugin";
import { defineConfig } from "vite";

/** Builds the mobile candidate form alone so its payload is measured without the demo shell. */
export default defineConfig(({ mode }) => ({
  plugins: [
    stylex.vite({
      dev: mode === "development",
      runtimeInjection: false,
      useCSSLayers: { before: foldworksLayers },
    }),
    foldkit(),
  ],
  build: {
    emptyOutDir: false,
    assetsDir: "apply",
    rollupOptions: { input: "apply.html" },
  },
}));
