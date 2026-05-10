import { z } from 'zod';

export const RegisterRequestSchema = z
	.object({
		email: z.string().trim().toLowerCase().pipe(z.email()),
		password: z.string().min(8),
	})
	.strict();

export const RegisterResponseSchema = z
	.object({
		userId: z.uuid(),
		email: z.email(),
		needsEmailConfirmation: z.boolean(),
	})
	.strict();
