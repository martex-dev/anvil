import { type JSX, type MouseEvent, useMemo } from 'react';

import { cn } from '../../lib/cn';
import { call } from '../../lib/ipc';
import { renderMarkdown } from '../../lib/markdown/markdown';
import { toast } from '../../stores/toast-store';
import { requestOpenFile } from '../../stores/workbench-store';
import { searchInFiles } from '../search/use-search';
import { anchorIndex, resolveRelative, resolveWikilink } from './viewer-paths';

import '../../lib/markdown/markdown.css';
import './viewers.css';

interface MarkdownHtmlProps {
	text: string;
	/** Workspace-relative path of the document, used to resolve relative links. */
	path: string;
	className?: string;
}

/** Opens the note an Obsidian `[[wikilink]]` (or `![[embed]]`) names, or says why it can't. */
async function openWikilink(fromFile: string, target: string): Promise<void> {
	if (!target.trim() || target.startsWith('#')) return;
	try {
		const { files } = await call('search:files');
		const hit = resolveWikilink(fromFile, target, files);
		if (hit) requestOpenFile({ path: hit });
		else toast.info('Note not found', `No file in this folder matches [[${target}]].`);
	} catch (error) {
		toast.error('Could not open link', error instanceof Error ? error.message : target);
	}
}

/**
 * Scrolls to the heading a same-document `#fragment` link names (GitHub-style anchors). The
 * document is the nearest `data-anchor-scope` (a notebook's cells), else this Markdown block.
 */
function scrollToAnchor(block: HTMLElement, fragment: string): void {
	const container = block.closest('[data-anchor-scope]') ?? block;
	const headings = [...container.querySelectorAll('h1, h2, h3, h4, h5, h6')];
	const index = anchorIndex(
		headings.map((h) => h.textContent ?? ''),
		fragment,
	);
	const heading = headings[index];
	if (heading) heading.scrollIntoView({ block: 'start' });
	else toast.info('No heading matches this link', `#${fragment}`);
}

/** Opens a web link in the browser; main refuses plain http to other hosts and says why. */
function openWebLink(href: string): void {
	call('app:openExternal', href).catch((error: unknown) =>
		toast.error('Could not open link', error instanceof Error ? error.message : href),
	);
}

/** Renders Markdown with the sanitizing renderer; every link click is routed, never navigated. */
export function MarkdownHtml({ text, path, className }: MarkdownHtmlProps): JSX.Element {
	const html = useMemo(() => renderMarkdown(text), [text]);

	const onClick = (event: MouseEvent<HTMLDivElement>): void => {
		const anchor = (event.target as HTMLElement).closest('a');
		if (!anchor) return;
		// The window must never navigate away from the app, whatever the link points to.
		event.preventDefault();
		const { wikilink, tag } = anchor.dataset;
		if (wikilink !== undefined) {
			void openWikilink(path, wikilink);
			return;
		}
		if (tag !== undefined) {
			searchInFiles(`#${tag}`);
			return;
		}
		const href = anchor.getAttribute('href') ?? '';
		if (/^https?:\/\//i.test(href)) {
			openWebLink(href);
			return;
		}
		if (!href || href === '#') return;
		if (href.startsWith('#')) {
			scrollToAnchor(event.currentTarget, href.slice(1));
			return;
		}
		if (/^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('//')) {
			toast.info('Only web links open externally', href);
			return;
		}
		const target = resolveRelative(path, href);
		if (!target) {
			toast.info('Link points outside the workspace', href);
			return;
		}
		requestOpenFile({ path: target });
	};

	return (
		<div
			className={cn('md-preview md-doc selectable', className)}
			// Raw HTML is disabled in lib/markdown, so the output is safe to inject.
			dangerouslySetInnerHTML={{ __html: html }}
			onClick={onClick}
		/>
	);
}
