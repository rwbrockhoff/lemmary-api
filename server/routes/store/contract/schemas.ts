import { z } from 'zod';
import { isValidTimeZone } from '../../../utils/timezone.js';
import { PRODUCTION_TYPE_VALUES } from '../../../db/enums.js';

export const UpdateStoreRequestSchema = z
	.object({
		storeName: z.string().trim().min(1).max(100).optional(),
		leadTimeDays: z.number().int().min(0).nullable().optional(),
		accessToken: z.string().min(1).optional(),
		storeUrl: z.url().nullable().optional(),
		logoUrl: z.url().nullable().optional(),
		tagline: z.string().trim().max(120).nullable().optional(),
		websiteUrl: z.url().nullable().optional(),
		contactEmail: z.email().nullable().optional(),
		defaultProductionType: z.enum(PRODUCTION_TYPE_VALUES).optional(),
		timezone: z
			.string()
			.refine(isValidTimeZone, { message: 'Invalid timezone' })
			.optional(),
		applyLeadTimeToOpenOrders: z.boolean().optional(),
	})
	.strict();

export const UpdateStoreResponseSchema = z
	.object({
		storeName: z.string(),
		platform: z.enum(['squarespace', 'shopify', 'etsy']),
		leadTimeDays: z.number().nullable(),
	})
	.strict();

export const CreateStoreRequestSchema = z
	.object({
		storeName: z.string().trim().min(1).max(100),
		accessToken: z.string().min(1),
		timezone: z
			.string()
			.refine(isValidTimeZone, { message: 'Invalid timezone' }),
		leadTimeDays: z.number().int().min(0).nullable().optional(),
		storeUrl: z.url().nullable().optional(),
	})
	.strict();

export const StoreResponseSchema = z.object({
	connected: z.boolean(),
	storeName: z.string().nullable(),
	platform: z.enum(['squarespace', 'shopify', 'etsy']).nullable(),
	leadTimeDays: z.number().nullable(),
	storeUrl: z.string().nullable(),
	logoUrl: z.string().nullable(),
	tagline: z.string().nullable(),
	websiteUrl: z.string().nullable(),
	contactEmail: z.string().nullable(),
	defaultProductionType: z.enum(PRODUCTION_TYPE_VALUES).nullable(),
	timezone: z.string().nullable(),
	lastSyncedAt: z.date().nullable(),
});
