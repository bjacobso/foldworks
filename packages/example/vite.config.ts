import { foldkit } from '@foldkit/vite-plugin'
import stylex from '@stylexjs/unplugin'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => ({
  plugins:
    mode === 'test'
      ? []
      : [
          stylex.vite({
            dev: mode === 'development',
            runtimeInjection: false,
            useCSSLayers: true,
          }),
          foldkit(),
        ],
  resolve: {
    alias:
      mode === 'test'
        ? { '@stylexjs/stylex': resolve(import.meta.dirname, 'src/test/stylex-stub.ts') }
        : {},
  },
  optimizeDeps: {
    entries: ['src/entry.ts'],
    exclude: [
      '@foldkit/ui',
      '@foldworks/workflow',
      'effect',
      'foldkit',
    ],
  },
}))
