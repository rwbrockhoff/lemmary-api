import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { badRequest, internalError } from '../utils/api-responses.js';

// Normalizes thrown/validation errors into our standard response shape.
// Fastify sets error.validation when a route's schema validation fails.
export function errorHandler(
	error: FastifyError,
	request: FastifyRequest,
	reply: FastifyReply,
) {
	if (error.validation) {
		return badRequest(reply, 'Validation failed', error.validation);
	}

	request.log.error(error, 'Unhandled request error');
	return internalError(reply);
}
