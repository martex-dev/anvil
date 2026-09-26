import { FileWarning } from 'lucide-react';
import { type JSX, lazy, Suspense, useEffect, useRef, useState } from 'react';

import { useSettings } from '../../app/hooks/use-settings';
import { PaneSplitter } from '../../app/PaneSplitter';
import { cn } from '../../lib/cn';
import { rlog } from '../../lib/log';
import { loadMonaco } from '../../lib/monaco/load';
import type { MonacoApi } from '../../lib/monaco/setup';
import { useLayoutStore } from '../../stores/layout-store';
import { type Group, useTabsStore } from '../../stores/tabs-store';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { Spinner } from '../../ui/Spinner';
import { Breadcrumbs } from './Breadcrumbs';
import { CodeEditor } from './CodeEditor';
import { useEditorStore } from './editor-store';
import { EditorDialogs } from './EditorDialogs';
import { FileStatus } from './FileStatus';
import { openUnloadedFiles } from './open';
import { TabBar } from './TabBar';
import { Watermark } from './Watermark';

// Viewers load on first use: most sessions never open a notebook or a parquet file.
const DataViewer = lazy(() =>
	import('../data/DataViewer').then((m) => ({ default: m.DataViewer })),
);
const ImageViewer = lazy(() =>
	import('../viewers/ImageViewer').then((m) => ({ default: m.ImageViewer })),
);
const NotebookViewer = lazy(() =>
	import('../viewers/NotebookViewer').then((m) => ({ default: m.NotebookViewer })),
);
const MarkdownPreview = lazy(() =>
	import('../viewers/MarkdownPreview').then((m) => ({ default: m.MarkdownPreview })),
);
const DiffViewer = lazy(() =>
	import('../viewers/DiffViewer').then((m) => ({ default: m.DiffViewer })),
);
const Welcome = lazy(() => import('../welcome/Welcome').then((m) => ({ default: m.Welcome })));

type MonacoState =
	| { status: 'idle' | 'loading' }
	| { status: 'ready'; monaco: MonacoApi }
	| { status: 'error'; message: string };

/** Boots Monaco (~10 MB) only once a code tab exists, then keeps it. */
function useMonaco(needed: boolean): [MonacoState, () => void] {
	const { settings } = useSettings();
	const [state, setState] = useState<MonacoState>({ status: 'idle' });
	const [attempt, setAttempt] = useState(0);
	useEffect(() => {
		if (!needed || state.status === 'ready' || state.status === 'error') return;
		let cancelled = false;
		loadMonaco(settings)
			.then((monaco) => {
				if (cancelled) return;
				setState({ status: 'ready', monaco });
				// Tabs opened while an earlier load failed still need their files read.
				openUnloadedFiles(monaco).catch((error: unknown) =>
					rlog.error('editor', 'reopening files after load failed', error),
				);
			})
			.catch((error: unknown) => {
				rlog.error('editor', 'monaco failed to load', error);
				if (!cancelled)
					setState({
						status: 'error',
						message: error instanceof Error ? error.message : String(error),
					});
			});
		return () => {
			cancelled = true;
		};
		// Settings changes are applied through refreshEditorConfiguration, not a reload.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [needed, attempt]);
	// Until it resolves, a needed-but-idle editor is simply loading.
	const shown: MonacoState = needed && state.status === 'idle' ? { status: 'loading' } : state;
	return [
		shown,
		() => {
			setState({ status: 'idle' });
			setAttempt((n) => n + 1);
		},
	];
}

function GroupView({
	group,
	monaco,
	retry,
	count,
}: {
	group: Group;
	monaco: MonacoState;
	retry: () => void;
	count: number;
}): JSX.Element {
	const focused = useTabsStore((s) => s.focused === group.id);
	const tab = useTabsStore((s) => (group.active ? s.tabs[group.active] : undefined));
	const file = useEditorStore((s) =>
		tab?.kind === 'code' && tab.path ? s.files.find((f) => f.path === tab.path) : undefined,
	);
	const codePath = tab?.kind === 'code' ? (tab.path ?? null) : null;

	// Code and diff tabs both wait on Monaco: a spinner while it boots, Retry if it failed.
	const monacoPending =
		monaco.status === 'error' ? (
			<ErrorState
				title='The editor failed to load'
				message={monaco.message}
				onRetry={retry}
			/>
		) : monaco.status !== 'ready' ? (
			<div className='flex h-full items-center justify-center'>
				<Spinner label='Loading editor' />
			</div>
		) : null;

	let body: JSX.Element | null = null;
	if (!tab) body = <Watermark />;
	else if (tab.kind === 'code') {
		if (monacoPending) body = monacoPending;
		else if (!file || file.state === 'loading')
			body = (
				<div className='flex h-full items-center justify-center'>
					<Spinner label='Loading editor' />
				</div>
			);
		else if (file.state !== 'ready') body = <FileStatus file={file} />;
	} else if (tab.kind === 'diff') {
		if (monacoPending) body = monacoPending;
		else if (!tab.diff)
			body = (
				<EmptyState
					icon={<FileWarning size={22} />}
					title='Nothing to compare'
					description='This diff has no content. Run the comparison again.'
				/>
			);
		else if (monaco.status === 'ready')
			body = (
				<Suspense
					fallback={
						<div className='flex h-full items-center justify-center'>
							<Spinner label='Loading viewer' />
						</div>
					}
				>
					<DiffViewer diff={tab.diff} monaco={monaco.monaco} />
				</Suspense>
			);
	} else if (tab.path || tab.kind === 'welcome') {
		body = (
			<Suspense
				fallback={
					<div className='flex h-full items-center justify-center'>
						<Spinner label='Loading viewer' />
					</div>
				}
			>
				{tab.kind === 'data' && tab.path && <DataViewer path={tab.path} />}
				{tab.kind === 'image' && tab.path && <ImageViewer path={tab.path} />}
				{tab.kind === 'notebook' && tab.path && <NotebookViewer path={tab.path} />}
				{tab.kind === 'markdown' && tab.path && <MarkdownPreview path={tab.path} />}
				{tab.kind === 'welcome' && <Welcome />}
			</Suspense>
		);
	}

	return (
		<section
			aria-label={`Editor group ${group.id + 1}`}
			data-part='editor-group'
			data-focused={focused}
			onMouseDown={() => useTabsStore.getState().focus(group.id)}
			className={cn(
				'glass glass-solid flex h-full min-w-0 flex-1 flex-col overflow-hidden',
				focused && count > 1 && 'pane-focus',
			)}
		>
			<span aria-hidden className='brackets-frame' data-focused={focused && count > 1} />
			{group.tabIds.length > 0 && <TabBar group={group} focused={focused} />}
			{tab && tab.kind === 'code' && <Breadcrumbs tab={tab} group={group.id} />}
			<div
				data-part='editor-surface'
				className='relative min-h-0 flex-1'
				style={{ background: 'var(--editor-bg)' }}
			>
				{monaco.status === 'ready' && (
					<CodeEditor
						monaco={monaco.monaco}
						group={group.id}
						path={codePath}
						visible={tab?.kind === 'code' && file?.state === 'ready'}
					/>
				)}
				{body && <div className='absolute inset-0 overflow-auto'>{body}</div>}
			</div>
		</section>
	);
}

/** One or two editor groups side by side. */
export function EditorArea(): JSX.Element {
	const groups = useTabsStore((s) => s.groups);
	const needsMonaco = useTabsStore((s) =>
		Object.values(s.tabs).some((t) => t.kind === 'code' || t.kind === 'diff'),
	);
	const [monaco, retry] = useMonaco(needsMonaco);
	const ratio = useLayoutStore((s) => s.splitRatio);
	const areaRef = useRef<HTMLDivElement>(null);
	const startRatio = useRef(ratio);

	return (
		<div ref={areaRef} className='flex h-full min-h-0 min-w-0'>
			{groups.map((group, i) => (
				<div
					key={group.id}
					className='flex min-w-0'
					style={{
						flex: groups.length > 1 ? `${i === 0 ? ratio : 1 - ratio} 1 0` : '1 1 0',
					}}
				>
					{i > 0 && (
						<PaneSplitter
							pane='splitRatio'
							axis='x'
							label='Resize editor groups'
							onStart={() =>
								(startRatio.current = useLayoutStore.getState().splitRatio)
							}
							onDrag={(delta) => {
								const width = areaRef.current?.clientWidth ?? 1;
								useLayoutStore
									.getState()
									.resize({ splitRatio: startRatio.current + delta / width });
							}}
							onReset={() => useLayoutStore.getState().resize({ splitRatio: 0.5 })}
						/>
					)}
					<GroupView group={group} monaco={monaco} retry={retry} count={groups.length} />
				</div>
			))}
			<EditorDialogs />
		</div>
	);
}
