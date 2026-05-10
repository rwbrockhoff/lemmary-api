import type { FastifyRequest, FastifyReply } from 'fastify';
import {
	successResponse,
	createdSuccess,
	badRequest,
	conflict,
	unauthorized,
	internalError,
} from '../../utils/api-responses.js';
import { env } from '../../config/environment.js';
import {
	REFRESH_TOKEN_COOKIE,
	REFRESH_TOKEN_MAX_AGE,
} from '../../config/constants.js';
import {
	RegisterRequestSchema,
	LoginRequestSchema,
} from './contract/schemas.js';
import { registerUser, loginUser } from './auth-service.js';

export async function handleRegister(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const parseResult = RegisterRequestSchema.safeParse(request.body);
	if (!parseResult.success) {
		return badRequest(reply, 'Invalid request', parseResult.error.format());
	}

	const { email, password } = parseResult.data;

	try {
		const result = await registerUser({ email, password });

		if (!result.success) {
			if (result.statusCode === 409) {
				return conflict(reply, result.error);
			}
			return badRequest(reply, result.error);
		}

		return createdSuccess(
			reply,
			{
				userId: result.userId,
				email,
				needsEmailConfirmation: result.needsEmailConfirmation,
			},
			'Registration successful. Please check your email to confirm your account.',
		);
	} catch (error) {
		request.log.error(error, 'Registration failed');
		return internalError(reply, 'Registration failed');
	}
}

export async function handleLogin(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const parseResult = LoginRequestSchema.safeParse(request.body);
	if (!parseResult.success) {
		return badRequest(reply, 'Invalid request', parseResult.error.format());
	}

	const { email, password } = parseResult.data;

	try {
		const result = await loginUser({ email, password });

		if (!result.success) {
			if (result.statusCode === 401) {
				return unauthorized(reply, result.error);
			}
			return internalError(reply, result.error);
		}

		reply.setCookie(REFRESH_TOKEN_COOKIE, result.refreshToken, {
			signed: true,
			httpOnly: true,
			secure: env.NODE_ENV === 'production',
			sameSite: 'lax',
			domain: env.NODE_ENV === 'production' ? '.lemmary.com' : undefined,
			path: '/',
			maxAge: REFRESH_TOKEN_MAX_AGE,
		});

		return successResponse(reply, {
			userId: result.userId,
			email: result.email,
		});
	} catch (error) {
		request.log.error(error, 'Login failed');
		return internalError(reply, 'Login failed');
	}
}
