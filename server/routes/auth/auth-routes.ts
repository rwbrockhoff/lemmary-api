import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ApiTags } from '../../openapi/tags.js';
import { successSchema } from '../../openapi/schemas.js';
import { AUTH_RATE_LIMIT } from '../../config/rate-limit.js';
import {
	RegisterRequestSchema,
	RegisterResponseSchema,
	LoginRequestSchema,
	LoginResponseSchema,
	DemoLoginResponseSchema,
	ForgotPasswordRequestSchema,
	ResetPasswordRequestSchema,
	ChangePasswordRequestSchema,
	ChangeEmailRequestSchema,
	IdentityResponseSchema,
	OauthSessionRequestSchema,
	OauthSessionResponseSchema,
	AuthStatusResponseSchema,
} from './contract/schemas.js';
import {
	handleRegister,
	handleLogin,
	handleDemoLogin,
	handleLogout,
	handleForgotPassword,
	handleResetPassword,
	handleChangePassword,
	handleChangeEmail,
	handleGetIdentity,
	handleStatus,
	handleOauthSession,
} from './auth-controller.js';

export async function authRoutes(app: FastifyInstance) {
	const r = app.withTypeProvider<ZodTypeProvider>();

	r.post(
		'/auth/register',
		{
			config: { rateLimit: AUTH_RATE_LIMIT },
			schema: {
				tags: [ApiTags.AUTH],
				summary: 'Register a new account',
				security: [],
				body: RegisterRequestSchema,
				response: {
					201: successSchema(RegisterResponseSchema),
				},
			},
		},
		handleRegister,
	);

	r.post(
		'/auth/login',
		{
			config: { rateLimit: AUTH_RATE_LIMIT },
			schema: {
				tags: [ApiTags.AUTH],
				summary: 'Log in with email and password',
				security: [],
				body: LoginRequestSchema,
				response: {
					200: successSchema(LoginResponseSchema),
				},
			},
		},
		handleLogin,
	);

	r.post(
		'/auth/demo',
		{
			schema: {
				tags: [ApiTags.AUTH],
				summary: 'Start a read-only demo session',
				security: [],
				response: {
					200: successSchema(DemoLoginResponseSchema),
				},
			},
		},
		handleDemoLogin,
	);

	r.post(
		'/auth/logout',
		{
			schema: {
				tags: [ApiTags.AUTH],
				summary: 'Log out and clear the session',
				security: [],
				response: {
					200: successSchema(z.null()),
				},
			},
		},
		handleLogout,
	);

	r.post(
		'/auth/forgot-password',
		{
			config: { rateLimit: AUTH_RATE_LIMIT },
			schema: {
				tags: [ApiTags.AUTH],
				summary: 'Request a password reset email',
				security: [],
				body: ForgotPasswordRequestSchema,
				response: {
					200: successSchema(z.null()),
				},
			},
		},
		handleForgotPassword,
	);

	r.post(
		'/auth/reset-password',
		{
			config: { rateLimit: AUTH_RATE_LIMIT },
			schema: {
				tags: [ApiTags.AUTH],
				summary: 'Reset password with a reset token',
				security: [],
				body: ResetPasswordRequestSchema,
				response: {
					200: successSchema(z.null()),
				},
			},
		},
		handleResetPassword,
	);

	r.get(
		'/auth/identity',
		{
			schema: {
				tags: [ApiTags.AUTH],
				summary: 'Get sign in methods for the current account',
				response: {
					200: successSchema(IdentityResponseSchema),
				},
			},
		},
		handleGetIdentity,
	);

	r.put(
		'/auth/password',
		{
			schema: {
				tags: [ApiTags.AUTH],
				summary: 'Change password while signed in',
				body: ChangePasswordRequestSchema,
				response: {
					200: successSchema(z.null()),
				},
			},
		},
		handleChangePassword,
	);

	r.put(
		'/auth/email',
		{
			schema: {
				tags: [ApiTags.AUTH],
				summary: 'Change email while signed in',
				body: ChangeEmailRequestSchema,
				response: {
					200: successSchema(z.null()),
				},
			},
		},
		handleChangeEmail,
	);

	r.post(
		'/auth/oauth/session',
		{
			schema: {
				tags: [ApiTags.AUTH],
				summary: 'Exchange OAuth tokens for a session',
				security: [],
				body: OauthSessionRequestSchema,
				response: {
					200: successSchema(OauthSessionResponseSchema),
				},
			},
		},
		handleOauthSession,
	);

	r.get(
		'/auth/status',
		{
			schema: {
				tags: [ApiTags.AUTH],
				summary: 'Get the current authentication status',
				security: [],
				response: {
					200: successSchema(AuthStatusResponseSchema),
				},
			},
		},
		handleStatus,
	);
}
