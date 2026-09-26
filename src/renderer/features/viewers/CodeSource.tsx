import type { JSX } from 'react';

import { cn } from '../../lib/cn';
import { useColorized } from './use-colorized';

export function CodeSource({
	source,
	language,
}: {
	source: string;
	language: string;
}): JSX.Element {
	const html = useColorized(source, language);
	const className = 'selectable overflow-x-auto px-3 py-2 font-mono text-12 leading-5';
	if (html) {
		return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
	}
	return <pre className={cn(className, 'whitespace-pre text-fg-0')}>{source || ' '}</pre>;
}
