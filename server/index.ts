import { initSentry } from './config/sentry.js';
initSentry();

import { env } from './config/environment.js';
import { buildApp } from './app.js';

const start = async () => {
	const app = buildApp();

	try {
		await app.listen({ port: env.PORT, host: '0.0.0.0' });
	} catch (err) {
		app.log.error(err);
		process.exit(1);
	}
};

start();
