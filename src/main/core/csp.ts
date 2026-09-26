/**
 * Content-Security-Policy for the renderer. Injected as a <meta> tag at build time because
 * production loads from file://, where response headers can't be set.
 * Dev needs 'unsafe-inline' for the React Refresh preamble and ws: for Vite HMR.
 */
export function buildCsp(mode: 'development' | 'production'): string {
	const dev = mode === 'development';
	const directives: Record<string, string[]> = {
		'default-src': ["'self'"],
		// wasm-unsafe-eval allows compiling WebAssembly only (TextMate's oniguruma), not eval().
		'script-src': dev
			? ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'"]
			: ["'self'", "'wasm-unsafe-eval'"],
		// Radix/motion inject <style> tags at runtime; styles can't execute code.
		'style-src': ["'self'", "'unsafe-inline'"],
		'img-src': ["'self'", 'data:', 'blob:', 'https:'],
		'font-src': ["'self'", 'data:'],
		'worker-src': ["'self'", 'blob:'],
		'connect-src': dev ? ["'self'", 'ws://localhost:*', 'http://localhost:*'] : ["'self'"],
		'object-src': ["'none'"],
		'base-uri': ["'none'"],
		'form-action': ["'none'"],
		'frame-src': ["'none'"],
	};
	return Object.entries(directives)
		.map(([key, values]) => `${key} ${values.join(' ')}`)
		.join('; ');
}
