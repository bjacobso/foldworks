import { foldkit } from '@foldkit/vite-plugin'
import stylex from '@stylexjs/unplugin'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import { uiDocs } from './ui-docs.ts'

export default defineConfig(({ mode }) => ({
  plugins:
    mode === 'test'
      ? []
      : [
          uiDocs(),
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
      '@foldworks/agent',
      '@foldworks/code-editor',
      '@foldworks/data-grid',
      '@foldworks/form-builder',
      '@foldworks/query-builder',
      '@foldworks/sidebar',
      '@foldworks/ui',
      '@foldworks/workflow',
      'effect',
      'foldkit',
    ],
  },
}))
