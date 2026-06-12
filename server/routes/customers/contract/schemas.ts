import { z } from 'zod';
import { CUSTOMER_TIERS } from '../../../utils/customer-tier.js';
import { ORDER_TYPE_VALUES } from '../../orders/contract/constants.js';

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
		order_type: z.enum(ORDER_TYPE_VALUES),
		order_date: z.coerce.date(),
		fulfillment_status: z.string(),
		due_date: z.iso.date().nullable(),
		subtotal: z.string().nullable(),
		grand_total: z.string().nullable(),
		item_count: z.number().int(),
		order_notes: z.string().nullable(),
	})
	.strict();

export const CustomerDetailSchema = z
	.object({
		email: z.email(),
		name: z.string(),
		tier: CustomerTierSchema,
		orderCount: z.number().int(),
		lifetimeSpend: z.string(),
		firstOrderDate: z.coerce.date(),
		orders: z.array(CustomerOrderSchema),
	})
	.strict();
