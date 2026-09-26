import { type JSX, type MouseEvent, useMemo } from 'react';

import { cn } from '../../lib/cn';
import { call } from '../../lib/ipc';
import { renderMarkdown } from '../../lib/markdown/markdown';
import { toast } from '../../stores/toast-store';
import { requestOpenFile } from '../../stores/workbench-store';
import { resolveRelative } from './viewer-paths';

import '../../lib/markdown/markdown.css';
import './viewers.css';

interface MarkdownHtmlProps {
	text: string;
	/** Workspace-relative path of the document, used to resolve relative links. */
	path: string;
	className?: string;
}

/** Renders Markdown with the sanitizing renderer; every link click is routed, never navigated. */
export function MarkdownHtml({ text, path, className }: MarkdownHtmlProps): JSX.Element {
	const html = useMemo(() => renderMarkdown(text), [text]);

	const onClick = (event: MouseEvent<HTMLDivElement>): void => {
		const anchor = (event.target as HTMLElement).closest('a');
		if (!anchor) return;
		// The window must never navigate away from the app, whatever the link points to.
		event.preventDefault();
		const href = anchor.getAttribute('href') ?? '';
		if (/^https:\/\//i.test(href)) {
			call('app:openExternal', href).catch(() => toast.error('Could not open link', href));
			return;
		}
		const target = resolveRelative(path, href);
		if (target) requestOpenFile({ path: target });
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
