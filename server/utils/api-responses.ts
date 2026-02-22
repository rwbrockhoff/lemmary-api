import type { FastifyReply } from 'fastify';

export enum ErrorCode {
	VALIDATION_ERROR = 'VALIDATION_ERROR',
	AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
	AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
	NOT_FOUND = 'NOT_FOUND',
	CONFLICT = 'CONFLICT',
	RATE_LIMIT = 'RATE_LIMIT',
	INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export const HTTP_STATUS = {
	OK: 200,
	CREATED: 201,
	NO_CONTENT: 204,
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	CONFLICT: 409,
	TOO_MANY_REQUESTS: 429,
	INTERNAL_SERVER_ERROR: 500,
} as const;

type ErrorResponse = {
	success: false;
	error: {
		message: string;
		code?: ErrorCode;
		details?: unknown;
	};
};

type SuccessResponse<T = unknown> = {
	success: true;
	data?: T;
	message?: string;
};

export const errorResponse = (
	reply: FastifyReply,
	status: number,
	message: string,
	code?: ErrorCode,
	details?: unknown,
): FastifyReply => {
	const body: ErrorResponse = {
		success: false,
		error: { message, code, details },
	};
	return reply.status(status).send(body);
};

export const successResponse = <T = unknown>(
	reply: FastifyReply,
	data?: T,
	message?: string,
): FastifyReply => {
	const body: SuccessResponse<T> = { success: true, data, message };
	return reply.status(HTTP_STATUS.OK).send(body);
};

export const createdSuccess = <T = unknown>(
	reply: FastifyReply,
	data?: T,
	message?: string,
): FastifyReply => {
	const body: SuccessResponse<T> = { success: true, data, message };
	return reply.status(HTTP_STATUS.CREATED).send(body);
};

export const noContent = (reply: FastifyReply): FastifyReply => {
	return reply.status(HTTP_STATUS.NO_CONTENT).send();
};

export const badRequest = (
	reply: FastifyReply,
	message: string,
	details?: unknown,
): FastifyReply =>
	errorResponse(
		reply,
		HTTP_STATUS.BAD_REQUEST,
		message,
		ErrorCode.VALIDATION_ERROR,
		details,
	);

export const unauthorized = (
	reply: FastifyReply,
	message = 'Authentication required',
): FastifyReply =>
	errorResponse(
		reply,
		HTTP_STATUS.UNAUTHORIZED,
		message,
		ErrorCode.AUTHENTICATION_ERROR,
	);

export const forbidden = (
	reply: FastifyReply,
	message = 'Access denied',
): FastifyReply =>
	errorResponse(
		reply,
		HTTP_STATUS.FORBIDDEN,
		message,
		ErrorCode.AUTHORIZATION_ERROR,
	);

export const notFound = (
	reply: FastifyReply,
	message = 'Resource not found',
): FastifyReply =>
	errorResponse(
		reply,
		HTTP_STATUS.NOT_FOUND,
		message,
		ErrorCode.NOT_FOUND,
	);

export const conflict = (
	reply: FastifyReply,
	message: string,
	details?: unknown,
): FastifyReply =>
	errorResponse(
		reply,
		HTTP_STATUS.CONFLICT,
		message,
		ErrorCode.CONFLICT,
		details,
	);

export const tooManyRequests = (
	reply: FastifyReply,
	message = 'Too many requests',
): FastifyReply =>
	errorResponse(
		reply,
		HTTP_STATUS.TOO_MANY_REQUESTS,
		message,
		ErrorCode.RATE_LIMIT,
	);

export const internalError = (
	reply: FastifyReply,
	message = 'Internal server error',
): FastifyReply =>
	errorResponse(
		reply,
		HTTP_STATUS.INTERNAL_SERVER_ERROR,
		message,
		ErrorCode.INTERNAL_ERROR,
	);
