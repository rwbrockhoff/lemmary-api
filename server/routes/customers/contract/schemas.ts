import { z } from 'zod';
import { CUSTOMER_TIERS } from '../../../utils/customer-tier.js';

export const CustomerTierSchema = z.enum(CUSTOMER_TIERS);

export const CustomerEmailParamSchema = z
	.object({
		email: z.email(),
	})
	.strict();

export const CustomerOrderSchema = z
	.object({
		id: z.uuid(),
		order_number: z.string(),
		order_date: z.coerce.date(),
		fulfillment_status: z.string(),
		due_date: z.coerce.date().nullable(),
		subtotal: z.string().nullable(),
		grand_total: z.string().nullable(),
		item_count: z.number().int(),
	})
	.strict();

export const CustomerDetailSchema = z
	.object({
		email: z.email(),
		name: z.string(),
		tier: CustomerTierSchema,
		orderCount: z.number().int(),
		lifetimeSpend: z.string(),
		orders: z.array(CustomerOrderSchema),
	})
	.strict();
