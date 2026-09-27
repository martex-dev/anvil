/**
 * What was typed in the Ollama box, with `http://` added when no scheme was given: people type
 * `localhost:11434` (as `ollama serve` prints it), which the URL check would otherwise reject.
 */
export function withOllamaScheme(text: string): string {
	const trimmed = text.trim();
	if (!trimmed || /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
	return `http://${trimmed}`;
}
