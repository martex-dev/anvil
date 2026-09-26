import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	{
		ignores: [
			'out/**',
			'dist/**',
			'release/**',
			'node_modules/**',
			'playwright-report/**',
			'test-results/**',
		],
	},
	js.configs.recommended,
	...tseslint.configs.strict,
	{
		plugins: { 'simple-import-sort': simpleImportSort },
		rules: {
			'simple-import-sort/imports': [
				'error',
				{
					groups: [['^node:'], ['^@?\\w'], ['^@(main|renderer|shared)/'], ['^\\.']],
				},
			],
			'simple-import-sort/exports': 'error',
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/consistent-type-imports': [
				'error',
				{ fixStyle: 'inline-type-imports' },
			],
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
			],
			'no-console': 'error',
		},
	},
	{
		files: [
			'src/main/**/*.ts',
			'src/preload/**/*.ts',
			'*.config.{ts,mjs}',
			'e2e/**/*.ts',
			'tests/**/*.ts',
		],
		languageOptions: { globals: globals.node },
	},
	{
		files: ['src/renderer/**/*.{ts,tsx}'],
		plugins: { react, 'react-hooks': reactHooks },
		languageOptions: { globals: globals.browser },
		settings: { react: { version: 'detect' } },
		rules: {
			...react.configs.recommended.rules,
			...react.configs['jsx-runtime'].rules,
			...reactHooks.configs.recommended.rules,
			'react/prop-types': 'off',
		},
	},
	{
		// Renderer must never reach for Node; enforce the process boundary at lint time.
		files: ['src/renderer/**/*.{ts,tsx}', 'src/shared/**/*.ts'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					// Exact names here: a gitignore-style pattern like 'fs' would also match './channels/fs'.
					paths: ['electron', 'fs', 'path', 'child_process', 'os', 'crypto'].map(
						(name) => ({
							name,
							message: 'Renderer/shared code cannot import Node or Electron.',
						}),
					),
					patterns: [
						{
							group: ['node:*'],
							message: 'Renderer/shared code cannot import Node or Electron.',
						},
						{ group: ['@main/*'], message: 'Only main may import @main.' },
					],
				},
			],
		},
	},
	prettier,
);
