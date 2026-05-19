import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		fileParallelism: false,
		include: ['server/**/*.test.ts'],
		testTimeout: 10000,
	},
});
