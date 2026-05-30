import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import {
	badRequest,
	errorResponse,
	internalError,
} from '../utils/api-responses.js';
import { AppError } from '../utils/app-error.js';
import { Sentry } from '../config/sentry.js';

// Single point where every thrown error becomes an HTTP response.
//   - Fastify validation errors → 400 with validation details
//   - AppError → formatted using its statusCode / code / message
//   - Anything else → logged, reported to Sentry, generic 500
export function errorHandler(
	error: FastifyError,
	request: FastifyRequest,
	reply: FastifyReply,
) {
	if (error.validation) {
		return badRequest(reply, 'Validation failed', error.validation);
	}

	if (error instanceof AppError) {
		return errorResponse(
			reply,
			error.statusCode,
			error.message,
			error.code,
			error.details,
		);
	}

	request.log.error(error, 'Unhandled request error');

	Sentry.captureException(error, {
		tags: { method: request.method, url: request.url },
	});

	return internalError(reply);
}
