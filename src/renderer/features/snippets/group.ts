import type { Snippet, SnippetCategory } from './library';

export interface SnippetGroup {
	category: SnippetCategory;
	snippets: Snippet[];
}

/**
 * Groups snippets by category. Groups appear in order of their first member, so search ranking
 * still decides which category comes first.
 */
export function groupByCategory(snippets: readonly Snippet[]): SnippetGroup[] {
	const groups = new Map<SnippetCategory, Snippet[]>();
	for (const s of snippets) {
		const list = groups.get(s.category);
		if (list) list.push(s);
		else groups.set(s.category, [s]);
	}
	return [...groups].map(([category, list]) => ({ category, snippets: list }));
}

/** DOM id of a snippet's row, for aria-activedescendant. */
export function snippetOptionId(snippet: Snippet): string {
	return `snippet-option-${snippet.id}`;
}
