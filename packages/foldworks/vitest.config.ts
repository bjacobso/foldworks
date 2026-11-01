import { defineConfig } from "vitest/config";

import { foldworksStylexTest } from "./src/ui/vite.ts";

export default defineConfig({ plugins: [foldworksStylexTest()] });
