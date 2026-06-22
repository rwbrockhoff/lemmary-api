import { execSync } from 'node:child_process';

// Reset + reseed the test database once before the suite
export default function setup() {
	// Guarded to test DB via NODE_ENV
	if (process.env.NODE_ENV !== 'test') {
		throw new Error('Refusing to reset the database: NODE_ENV must be "test"');
	}
	// execSync runs shell command sync
	execSync('npm run test:setup', { stdio: 'inherit' });
}
