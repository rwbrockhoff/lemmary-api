import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		poolOptions: { threads: { singleThread: true } },
		include: ['server/**/*.test.ts'],
		testTimeout: 10000,
	},
});
