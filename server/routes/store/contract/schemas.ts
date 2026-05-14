import { z } from 'zod';

export const UpdateStoreRequestSchema = z
	.object({
		storeName: z.string().trim().min(1).max(100).optional(),
		leadTimeDays: z.number().int().min(0).nullable().optional(),
		accessToken: z.string().min(1).optional(),
		storeUrl: z.url().nullable().optional(),
	})
	.strict();

export const UpdateStoreResponseSchema = z
	.object({
		storeName: z.string(),
		platform: z.enum(['squarespace', 'shopify', 'etsy']),
		leadTimeDays: z.number().nullable(),
	})
	.strict();
