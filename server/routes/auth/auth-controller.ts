import type { FastifyRequest, FastifyReply } from 'fastify';
import {
	successResponse,
	createdSuccess,
} from '../../utils/api-responses.js';
import { AppError } from '../../utils/app-error.js';
import {
	REFRESH_TOKEN_COOKIE,
	DEMO_SESSION_TOKEN,
	DEMO_USER_ID,
} from '../../config/constants.js';
import {
	refreshCookieOptions,
	clearRefreshCookieOptions,
} from '../../utils/cookies.js';
import type {
	RegisterRequest,
	LoginRequest,
	ForgotPasswordRequest,
	ResetPasswordRequest,
	OauthSessionRequest,
} from './contract/types.js';
import {
	registerUser,
	loginUser,
	requestPasswordReset,
	resetPassword,
	exchangeOauthSession,
	getCurrentUser,
} from './auth-service.js';

export async function handleRegister(
	request: FastifyRequest<{ Body: RegisterRequest }>,
	reply: FastifyReply,
) {
	const { email, password, firstName, lastName } = request.body;
	const result = await registerUser({ email, password, firstName, lastName });

	if (!result.success) {
		if (result.statusCode === 409) throw AppError.conflict(result.error);
		throw AppError.badRequest(result.error);
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
}

export async function handleLogin(
	request: FastifyRequest<{ Body: LoginRequest }>,
	reply: FastifyReply,
) {
	const { email, password } = request.body;
	const result = await loginUser({ email, password });

	if (!result.success) {
		if (result.statusCode === 401) throw AppError.unauthorized(result.error);
		throw new AppError(result.error);
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

// Intentionally swallows errors and always returns the same message so we don't
// leak whether an account exists for the given email.
export async function handleForgotPassword(
	request: FastifyRequest<{ Body: ForgotPasswordRequest }>,
	reply: FastifyReply,
) {
	const { email } = request.body;

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
	request: FastifyRequest<{ Body: OauthSessionRequest }>,
	reply: FastifyReply,
) {
	const { accessToken, refreshToken } = request.body;
	const result = await exchangeOauthSession({ accessToken, refreshToken });

	if (!result.success) throw AppError.unauthorized(result.error);

	reply.setCookie(REFRESH_TOKEN_COOKIE, refreshToken, refreshCookieOptions);

	return successResponse(reply, {
		userId: result.userId,
		email: result.email,
	});
}

export async function handleResetPassword(
	request: FastifyRequest<{ Body: ResetPasswordRequest }>,
	reply: FastifyReply,
) {
	const { accessToken, newPassword } = request.body;
	const result = await resetPassword({ accessToken, newPassword });

	if (!result.success) {
		if (result.statusCode === 401) throw AppError.unauthorized(result.error);
		throw AppError.badRequest(result.error);
	}

	return successResponse(reply, null, 'Password updated successfully');
}
