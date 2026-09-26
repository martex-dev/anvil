/**
 * Makes text literal inside a Markdown string (Monaco hovers): commit messages like
 * `fix __init__ and *args` must not turn bold or italic.
 */
export function escapeMarkdown(text: string): string {
	return text.replace(/[\\`*_{}[\]()#+\-.!|<>~]/g, '\\$&');
}
