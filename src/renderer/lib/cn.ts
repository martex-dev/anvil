type ClassValue = string | false | null | undefined;

/** Joins truthy class names. Tiny on purpose: we don't need clsx/tailwind-merge. */
export function cn(...classes: ClassValue[]): string {
	return classes.filter(Boolean).join(' ');
}
