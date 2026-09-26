export type TransformGroup = 'Case' | 'Lines' | 'Encode' | 'Decode' | 'Clean' | 'Code';

export interface Transform {
	/** kebab-case, unique across TRANSFORMS. */
	id: string;
	/** Shown in the picker, e.g. 'snake_case'. */
	label: string;
	group: TransformGroup;
	/** Example of the output, shown in the picker, e.g. 'my_variable_name'. */
	example: string;
	/** Throws an Error with a user-facing message on invalid input (e.g. bad base64). */
	run(text: string): string;
}
