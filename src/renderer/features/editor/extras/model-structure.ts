import type * as Monaco from 'monaco-editor';

import { outlineFor, type OutlineSymbol } from '../../outline/outline';
import { type Cell, findCells } from '../../python/cells';

/** The model shape the cache reads (a Monaco text model, or a test stand-in). */
type Model = Pick<Monaco.editor.ITextModel, 'getVersionId' | 'getLanguageId' | 'getLinesContent'>;

interface Parsed {
	version: number;
	language: string;
	lines?: string[];
	cells?: Cell[];
	outline?: OutlineSymbol[];
}

/**
 * Lines, `# %%` cells and outline per model version, computed on first use. The cell wash and
 * spotlight ask on every cursor move; rescanning a large file each time made typing sluggish.
 */
const cache = new WeakMap<Model, Parsed>();

function entry(model: Model): Parsed {
	const version = model.getVersionId();
	const language = model.getLanguageId();
	let parsed = cache.get(model);
	if (!parsed || parsed.version !== version || parsed.language !== language) {
		parsed = { version, language };
		cache.set(model, parsed);
	}
	return parsed;
}

export function linesOf(model: Model): readonly string[] {
	const parsed = entry(model);
	parsed.lines ??= model.getLinesContent();
	return parsed.lines;
}

/** `# %%` cells of a Python model; none for other languages. */
export function cellsOf(model: Model): readonly Cell[] {
	const parsed = entry(model);
	if (parsed.language !== 'python') return [];
	parsed.cells ??= findCells(linesOf(model));
	return parsed.cells;
}

export function outlineOf(model: Model): readonly OutlineSymbol[] {
	const parsed = entry(model);
	parsed.outline ??= outlineFor(parsed.language, linesOf(model));
	return parsed.outline;
}
