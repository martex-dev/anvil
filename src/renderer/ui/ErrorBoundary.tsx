import { Component, type ErrorInfo, type JSX, type ReactNode } from 'react';

import { cn } from '@renderer/lib/cn';
import { rlog } from '@renderer/lib/log';

import { ErrorState } from './ErrorState';

interface ErrorBoundaryProps {
	children: ReactNode;
	/** Log scope and the pane's name in the fallback title ("Explorer failed to render"). */
	name: string;
	/** Changing this clears a caught error, e.g. the side bar's current view. */
	resetKey?: string;
	className?: string;
}

interface ErrorBoundaryState {
	error: Error | null;
	resetKey: string | undefined;
}

/** Normalises whatever was thrown into an Error (React passes through non-Error throws). */
export function toError(thrown: unknown): Error {
	return thrown instanceof Error ? thrown : new Error(String(thrown));
}

/**
 * Catches render errors (and failed lazy imports) below it so one broken view shows an error
 * state with Retry instead of unmounting the whole workbench. Error boundaries must be class
 * components: React has no hook equivalent.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	override state: ErrorBoundaryState = { error: null, resetKey: this.props.resetKey };

	static getDerivedStateFromError(thrown: unknown): Partial<ErrorBoundaryState> {
		return { error: toError(thrown) };
	}

	static getDerivedStateFromProps(
		props: ErrorBoundaryProps,
		state: ErrorBoundaryState,
	): Partial<ErrorBoundaryState> | null {
		// A new resetKey (e.g. switching side views) gives the new content a fresh chance.
		if (props.resetKey !== state.resetKey) return { error: null, resetKey: props.resetKey };
		return null;
	}

	override componentDidCatch(error: Error, info: ErrorInfo): void {
		rlog.error(
			this.props.name,
			`render failed: ${error.message}${info.componentStack ?? ''}`,
			error,
		);
	}

	private readonly retry = (): void => this.setState({ error: null });

	override render(): ReactNode {
		const { error } = this.state;
		if (!error) return this.props.children;
		return (
			<BoundaryFallback
				name={this.props.name}
				error={error}
				onRetry={this.retry}
				className={this.props.className}
			/>
		);
	}
}

function BoundaryFallback({
	name,
	error,
	onRetry,
	className,
}: {
	name: string;
	error: Error;
	onRetry: () => void;
	className: string | undefined;
}): JSX.Element {
	return (
		<div className={cn('h-full min-h-0 overflow-auto', className)}>
			<ErrorState
				title={`${name} failed to render`}
				message={error.message}
				onRetry={onRetry}
			/>
		</div>
	);
}
