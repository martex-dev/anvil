import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: {
			'@main': resolve(__dirname, 'src/main'),
			'@renderer': resolve(__dirname, 'src/renderer'),
			'@shared': resolve(__dirname, 'src/shared'),
		},
	},
	test: {
		include: ['src/**/*.test.{ts,tsx}'],
		environment: 'node',
		// Vitest blanks CSS by default; the palette test reads each skin's palettes.css as text.
		css: { include: [/palettes\.css/] },
	},
});
