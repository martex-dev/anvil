/** Error with a stable machine-readable code that is safe to show to the renderer. */
export class AnvilError extends Error {
	constructor(
		readonly code: string,
		message: string,
		override readonly cause?: unknown,
	) {
		super(message);
		this.name = 'AnvilError';
	}
}

export function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
