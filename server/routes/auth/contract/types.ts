import { z } from 'zod';
import {
	RegisterRequestSchema,
	RegisterResponseSchema,
	LoginRequestSchema,
	LoginResponseSchema,
	ForgotPasswordRequestSchema,
	ResetPasswordRequestSchema,
	AuthStatusResponseSchema,
	AuthUserSchema,
	OauthSessionRequestSchema,
	OauthSessionResponseSchema,
} from './schemas.js';

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;
export type AuthStatusResponse = z.infer<typeof AuthStatusResponseSchema>;
export type CurrentUser = z.infer<typeof AuthUserSchema>;
export type OauthSessionRequest = z.infer<typeof OauthSessionRequestSchema>;
export type OauthSessionResponse = z.infer<typeof OauthSessionResponseSchema>;
