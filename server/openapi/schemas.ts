import { z } from 'zod';

export const successSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
	z.object({
		success: z.literal(true),
		data: dataSchema,
		message: z.string().optional(),
	});

export const emptySuccessSchema = z.object({
	success: z.literal(true),
	message: z.string().optional(),
});

export const errorSchema = z.object({
	success: z.literal(false),
	error: z.object({
		message: z.string(),
		code: z.string().optional(),
		details: z.unknown().optional(),
	}),
});
