import { ErrorCode } from './api-responses.js';

// Throw AppError from controllers/services to signal expected failures (4xx, business logic errors).
// The global errorHandler catches it and formats it into our standard error response.
// Anything else thrown is treated as an unexpected bug and reported to Sentry.

export class AppError extends Error {
	statusCode: number;
	code: ErrorCode;
	details?: unknown;

	constructor(
		message: string,
		statusCode: number = 500,
		code: ErrorCode = ErrorCode.INTERNAL_ERROR,
		details?: unknown,
	) {
		super(message);
		this.name = 'AppError';
		this.statusCode = statusCode;
		this.code = code;
		this.details = details;
	}

	static badRequest(message: string, details?: unknown) {
		return new AppError(message, 400, ErrorCode.VALIDATION_ERROR, details);
	}

	static unauthorized(message = 'Authentication required') {
		return new AppError(message, 401, ErrorCode.AUTHENTICATION_ERROR);
	}

	static forbidden(message = 'Access denied') {
		return new AppError(message, 403, ErrorCode.AUTHORIZATION_ERROR);
	}

	static notFound(message = 'Resource not found') {
		return new AppError(message, 404, ErrorCode.NOT_FOUND);
	}

	static conflict(message: string, details?: unknown) {
		return new AppError(message, 409, ErrorCode.CONFLICT, details);
	}
}
