import * as Sentry from '@sentry/node';
import { env } from './environment.js';

let initialized = false;

export const initSentry = () => {
	if (initialized) return;

	// only capture errors in production
	if (env.NODE_ENV !== 'production') return;

	if (!env.SENTRY_DSN) return;

	Sentry.init({
		dsn: env.SENTRY_DSN,
		environment: env.NODE_ENV,
	});

	initialized = true;
};

export { Sentry };
