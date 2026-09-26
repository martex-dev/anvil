import { resolve } from 'node:path';

import importMetaUrlPlugin from '@codingame/esbuild-import-meta-url-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';
import type { Plugin } from 'vite';

import { buildCsp } from './src/main/core/csp';

function cspPlugin(): Plugin {
	let mode: 'development' | 'production' = 'production';
	return {
		name: 'forge-csp',
		configResolved(config) {
			mode = config.command === 'serve' ? 'development' : 'production';
		},
		transformIndexHtml() {
			return [
				{
					tag: 'meta',
					attrs: { 'http-equiv': 'Content-Security-Policy', content: buildCsp(mode) },
					injectTo: 'head-prepend',
				},
			];
		},
	};
}

const alias = {
	'@main': resolve(__dirname, 'src/main'),
	'@renderer': resolve(__dirname, 'src/renderer'),
	'@shared': resolve(__dirname, 'src/shared'),
};

export default defineConfig({
	main: {
		resolve: { alias },
		build: {
			rollupOptions: { input: { index: resolve(__dirname, 'src/main/index.ts') } },
		},
	},
	preload: {
		resolve: { alias },
		build: {
			// Sandboxed preloads can only require('electron'), so everything else must be bundled.
			externalizeDeps: false,
			rollupOptions: { input: { index: resolve(__dirname, 'src/preload/index.ts') } },
		},
	},
	renderer: {
		root: resolve(__dirname, 'src/renderer'),
		resolve: { alias },
		plugins: [react(), tailwindcss(), cspPlugin()],
		// monaco-vscode-api resolves assets (WASM, codicons, workers) with new URL(…, import.meta.url);
		// esbuild's dev pre-bundling would break those URLs without this plugin.
		optimizeDeps: {
			esbuildOptions: { plugins: [importMetaUrlPlugin] },
			include: ['vscode-textmate', 'vscode-oniguruma'],
		},
		worker: { format: 'es' },
		build: {
			rollupOptions: { input: { index: resolve(__dirname, 'src/renderer/index.html') } },
			// The editor chunk is large by nature and loaded lazily; don't warn about it.
			chunkSizeWarningLimit: 12_000,
			// Never inline assets as data: URLs — editor extensions fetch() their files, and the
			// CSP only allows connecting to our own origin (app://forge).
			assetsInlineLimit: 0,
		},
	},
});
