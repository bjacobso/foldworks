import { foldkit } from "@foldkit/vite-plugin";
import stylex from "@stylexjs/unplugin";
import type { Plugin } from "vite";
import { defineConfig } from "vite";

const inlineMcpApp = (): Plugin => ({
  name: "inline-mcp-app",
  enforce: "post",
  generateBundle(_options, bundle) {
    const htmlEntry = Object.values(bundle).find(
      (entry) => entry.type === "asset" && entry.fileName === "mcp-app.html",
    );
    if (htmlEntry === undefined || htmlEntry.type !== "asset")
      throw new Error("The MCP App HTML entry was not generated.");

    let html = String(htmlEntry.source);
    for (const [fileName, entry] of Object.entries(bundle)) {
      if (entry.type === "chunk") {
        const source = entry.code.replaceAll("</script", "<\\/script");
        html = html.replace(
          new RegExp(`<script[^>]+src=["'][^"']*${fileName}["'][^>]*></script>`),
          () => `<script type="module">${source}</script>`,
        );
        delete bundle[fileName];
        continue;
      }
      if (fileName.endsWith(".css")) {
        html = html.replace(
          new RegExp(`<link[^>]+href=["'][^"']*${fileName}["'][^>]*>`),
          () => `<style>${String(entry.source)}</style>`,
        );
        delete bundle[fileName];
      }
    }
    if (/<(?:script|link)\b[^>]*(?:src|href)=/i.test(html))
      throw new Error("The MCP App bundle still contains an external asset reference.");
    htmlEntry.source = html;
  },
});

export default defineConfig(({ mode }) => ({
  plugins: [
    stylex.vite({
      dev: mode === "development",
      runtimeInjection: false,
      useCSSLayers: true,
    }),
    foldkit(),
    inlineMcpApp(),
  ],
  build: {
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    emptyOutDir: false,
    modulePreload: false,
    rollupOptions: {
      input: "mcp-app.html",
      output: { codeSplitting: false },
    },
  },
}));
