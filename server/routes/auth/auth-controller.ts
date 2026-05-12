import type { FastifyRequest, FastifyReply } from 'fastify';
import {
	successResponse,
	createdSuccess,
	badRequest,
	conflict,
	unauthorized,
	internalError,
} from '../../utils/api-responses.js';
import {
	REFRESH_TOKEN_COOKIE,
	DEMO_SESSION_TOKEN,
	DEMO_USER_ID,
} from '../../config/constants.js';
import {
	refreshCookieOptions,
	clearRefreshCookieOptions,
} from '../../utils/cookies.js';
import {
	RegisterRequestSchema,
	LoginRequestSchema,
	ForgotPasswordRequestSchema,
	ResetPasswordRequestSchema,
	OauthSessionRequestSchema,
} from './contract/schemas.js';
import {
	registerUser,
	loginUser,
	requestPasswordReset,
	resetPassword,
	exchangeOauthSession,
	getCurrentUser,
} from './auth-service.js';

export async function handleRegister(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const parseResult = RegisterRequestSchema.safeParse(request.body);
	if (!parseResult.success) {
		return badRequest(reply, 'Invalid request', parseResult.error.format());
	}

	const { email, password, firstName, lastName } = parseResult.data;

	try {
		const result = await registerUser({ email, password, firstName, lastName });

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

		reply.setCookie(
			REFRESH_TOKEN_COOKIE,
			result.refreshToken,
			refreshCookieOptions,
		);

		return successResponse(reply, {
			userId: result.userId,
			email: result.email,
		});
	} catch (error) {
		request.log.error(error, 'Login failed');
		return internalError(reply, 'Login failed');
	}
}

export async function handleDemoLogin(
	_request: FastifyRequest,
	reply: FastifyReply,
) {
	reply.setCookie(
		REFRESH_TOKEN_COOKIE,
		DEMO_SESSION_TOKEN,
		refreshCookieOptions,
	);
	return successResponse(reply, {
		userId: DEMO_USER_ID,
		email: 'demo@twelvestitch.com',
		isDemo: true,
	});
}

export async function handleLogout(
	_request: FastifyRequest,
	reply: FastifyReply,
) {
	reply.clearCookie(REFRESH_TOKEN_COOKIE, clearRefreshCookieOptions);
	return successResponse(reply, null, 'Logged out');
}

export async function handleStatus(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	if (!request.userId) {
		return successResponse(reply, { isAuthenticated: false, user: null });
	}

	const user = await getCurrentUser(request.userId);
	if (!user) {
		return successResponse(reply, { isAuthenticated: false, user: null });
	}

	return successResponse(reply, { isAuthenticated: true, user });
}

export async function handleForgotPassword(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const parseResult = ForgotPasswordRequestSchema.safeParse(request.body);
	if (!parseResult.success) {
		return badRequest(reply, 'Invalid request', parseResult.error.format());
	}

	const { email } = parseResult.data;

	try {
		await requestPasswordReset(email);
	} catch (error) {
		request.log.error(error, 'Password reset request failed');
	}

	return successResponse(
		reply,
		null,
		'If an account exists for that email, a reset link has been sent.',
	);
}

export async function handleOauthSession(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const parseResult = OauthSessionRequestSchema.safeParse(request.body);
	if (!parseResult.success) {
		return badRequest(reply, 'Invalid request', parseResult.error.format());
	}

	const { accessToken, refreshToken } = parseResult.data;

	try {
		const result = await exchangeOauthSession({ accessToken, refreshToken });

		if (!result.success) {
			return unauthorized(reply, result.error);
		}

		reply.setCookie(REFRESH_TOKEN_COOKIE, refreshToken, refreshCookieOptions);

		return successResponse(reply, {
			userId: result.userId,
			email: result.email,
		});
	} catch (error) {
		request.log.error(error, 'OAuth session exchange failed');
		return internalError(reply, 'OAuth session exchange failed');
	}
}

export async function handleResetPassword(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const parseResult = ResetPasswordRequestSchema.safeParse(request.body);
	if (!parseResult.success) {
		return badRequest(reply, 'Invalid request', parseResult.error.format());
	}

	const { accessToken, newPassword } = parseResult.data;

	try {
		const result = await resetPassword({ accessToken, newPassword });

		if (!result.success) {
			if (result.statusCode === 401) {
				return unauthorized(reply, result.error);
			}
			return badRequest(reply, result.error);
		}

		return successResponse(reply, null, 'Password updated successfully');
	} catch (error) {
		request.log.error(error, 'Password update failed');
		return internalError(reply, 'Password update failed');
	}
}
