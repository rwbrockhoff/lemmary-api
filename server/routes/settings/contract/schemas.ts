import { z } from 'zod';

export const StoreSettingsResponseSchema = z.object({
	storeName: z.string().nullable(),
	platform: z.enum(['squarespace', 'shopify', 'etsy']).nullable(),
	leadTimeDays: z.number().nullable(),
	storeUrl: z.string().nullable(),
	timezone: z.string().nullable(),
});

export const UpdateLeadTimeRequestSchema = z.object({
	leadTimeDays: z.number().int().min(0).nullable(),
});

export const UpdateLeadTimeResponseSchema = z.object({
	leadTimeDays: z.number().nullable(),
});
