import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ApiTags } from '../../openapi/tags.js';
import { successSchema, emptySuccessSchema } from '../../openapi/schemas.js';
import {
	SubscriptionResponseSchema,
	CreateSubscriptionResponseSchema,
} from './contract/schemas.js';
import {
	handleGetSubscription,
	handleCreateSubscription,
	handleCancelSubscription,
	handleSubscriptionCallback,
} from './subscription-controller.js';

export async function subscriptionRoutes(app: FastifyInstance) {
	const r = app.withTypeProvider<ZodTypeProvider>();

	r.get(
		'/subscription',
		{
			schema: {
				tags: [ApiTags.STORE],
				summary: 'Get current subscription status',
				response: {
					200: successSchema(SubscriptionResponseSchema),
				},
			},
		},
		handleGetSubscription,
	);

	r.post(
		'/subscription',
		{
			schema: {
				tags: [ApiTags.STORE],
				summary: 'Start a subscription',
				response: {
					200: successSchema(CreateSubscriptionResponseSchema),
				},
			},
		},
		handleCreateSubscription,
	);

	r.delete(
		'/subscription',
		{
			schema: {
				tags: [ApiTags.STORE],
				summary: 'Cancel the subscription',
				response: {
					200: emptySuccessSchema,
				},
			},
		},
		handleCancelSubscription,
	);

	r.get(
		'/subscription/callback',
		{ schema: { hide: true } },
		handleSubscriptionCallback,
	);
}
