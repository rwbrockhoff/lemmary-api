import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
	globalIgnores(['dist', 'coverage']),
	{
		files: ['**/*.ts'],
		extends: [js.configs.recommended, tseslint.configs.recommended],
		languageOptions: {
			ecmaVersion: 2022,
			globals: globals.node,
		},
	},
	{
		// Kysely migrations run using Kysely<any> (docs recommended approach for this)
		files: ['server/db/migrations/**/*.ts', 'server/db/migrate.ts'],
		rules: { '@typescript-eslint/no-explicit-any': 'off' },
	},
]);
