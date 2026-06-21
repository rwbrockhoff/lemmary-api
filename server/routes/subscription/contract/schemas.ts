import { z } from 'zod';

export const SubscriptionResponseSchema = z.object({
	access: z.boolean(),
	subscribed: z.boolean(),
	status: z.string().nullable(),
	planName: z.string().nullable(),
	price: z.string().nullable(),
	trialEndsAt: z.string().nullable(),
	currentPeriodEnd: z.string().nullable(),
	cancelAtPeriodEnd: z.boolean(),
});

export const CreateSubscriptionResponseSchema = z.object({
	confirmationUrl: z.string(),
});
