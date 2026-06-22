import { defineConfig } from 'vitest/config';

// Pin test env before config resolves so test DB (.env.test) is used
process.env.NODE_ENV = 'test';

export default defineConfig({
	test: {
		globals: true,
		fileParallelism: false,
		include: ['server/**/*.test.ts'],
		testTimeout: 10000,
		globalSetup: './server/tests/global-setup.ts',
		env: { NODE_ENV: 'test' },
	},
});
