import { z } from 'zod';

export const RegisterRequestSchema = z
	.object({
		email: z.string().trim().toLowerCase().pipe(z.email()),
		password: z.string().min(8),
		firstName: z.string().trim().min(1).max(100),
		lastName: z.string().trim().min(1).max(100),
	})
	.strict();

export const RegisterResponseSchema = z
	.object({
		userId: z.uuid(),
		email: z.email(),
		needsEmailConfirmation: z.boolean(),
	})
	.strict();

export const LoginRequestSchema = z
	.object({
		email: z.string().trim().toLowerCase().pipe(z.email()),
		password: z.string().min(1),
	})
	.strict();

export const LoginResponseSchema = z
	.object({
		userId: z.uuid(),
		email: z.email(),
	})
	.strict();

export const ForgotPasswordRequestSchema = z
	.object({
		email: z.string().trim().toLowerCase().pipe(z.email()),
	})
	.strict();

export const ResetPasswordRequestSchema = z
	.object({
		accessToken: z.string().min(1),
		newPassword: z.string().min(8),
	})
	.strict();

export const AuthUserSchema = z
	.object({
		userId: z.uuid(),
		email: z.email(),
		firstName: z.string().nullable(),
		lastName: z.string().nullable(),
		avatarUrl: z.string().nullable(),
	})
	.strict();

export const AuthStatusResponseSchema = z
	.object({
		isAuthenticated: z.boolean(),
		user: AuthUserSchema.nullable(),
	})
	.strict();

export const OauthSessionRequestSchema = z
	.object({
		accessToken: z.string().min(1),
		refreshToken: z.string().min(1),
	})
	.strict();

export const OauthSessionResponseSchema = z
	.object({
		userId: z.uuid(),
		email: z.email(),
	})
	.strict();
