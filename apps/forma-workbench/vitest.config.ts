import { foldworksStylexTest } from "foldworks/ui/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [foldworksStylexTest()],
  test: { include: ["src/**/*.test.ts", "test/**/*.test.ts"] },
});
