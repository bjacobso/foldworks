import { defineConfig } from "vitest/config";

import { foldworksStylexTest } from "./src/vite.ts";

export default defineConfig({ plugins: [foldworksStylexTest()] });
