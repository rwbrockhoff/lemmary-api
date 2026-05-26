import type { FastifyBaseLogger, FastifySerializerCompiler } from 'fastify';
import type { ZodType } from 'zod';
import { env } from '../config/environment.js';

// Fastify runs a serializer to turn each route's response into the JSON it sends back.
// We slot ours in here to first check the response against its Zod schema, so we catch
// any drift from the contract without changing what the client actually receives.

type DriftContext = {
	method: string;
	url: string;
	issues: { path: string; message: string }[];
};

const isDevOrTest = () =>
	env.NODE_ENV === 'development' || env.NODE_ENV === 'test';

// Log util to use Fastify Pino logger for schema issues
const reportResponseDrift = (log: FastifyBaseLogger, context: DriftContext) => {
	log.error(context, 'Response schema drift detected');
};

export const createResponseSerializer =
	(log: FastifyBaseLogger): FastifySerializerCompiler<ZodType> =>
	({ schema, method, url }) =>
	(data) => {
		const result = schema.safeParse(data);

		// Log response schema validation errors in all environments
		if (!result.success) {
			const issues = result.error.issues.map((issue) => ({
				path: issue.path.join('.') || 'root',
				message: issue.message,
			}));
			reportResponseDrift(log, { method, url, issues });

			// Throw errors in dev/test environment
			if (isDevOrTest()) {
				throw new Error(`Response schema drift: ${method} ${url}`);
			}
		}

		return JSON.stringify(data);
	};
